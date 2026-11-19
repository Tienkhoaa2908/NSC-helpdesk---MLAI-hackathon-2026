import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Filter } from "mongodb";
import { accountRequestSchema, type AccountRequest, type PasswordAccount } from "@/domain/password-identity";
import { identityStore, identityTransaction } from "@/lib/identity-store";
import { assertIdentityCredentialEncryptionConfigured, decryptTemporaryPassword, encryptTemporaryPassword, generateTemporaryPassword } from "@/lib/identity-credentials";
import {
  assertIdentityEmailConfigured,
  sendAccountRequestNotice,
  sendAccountRequestRejected,
  sendIssuedCredentials,
} from "@/lib/identity-mailer";
import { SupportError } from "@/lib/support-repository";

const APPROVAL_PROCESSING_MS = 2 * 60_000;
const isDuplicateKeyError = (error: unknown) => typeof error === "object" && error !== null &&
  "code" in error && (error as { code?: unknown }).code === 11000;

type NoticeScheduler = (work: () => Promise<void>) => void;

export async function submitAccountRequest(value: unknown, scheduleNotice?: NoticeScheduler) {
  const input = accountRequestSchema.parse(value);
  const now = new Date();
  let requestId: string | null;
  const processingUntil = new Date(now.getTime() + APPROVAL_PROCESSING_MS);
  try {
    requestId = await identityTransaction(async (transactionDb, session) => {
      const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
      const accounts = transactionDb.collection<PasswordAccount>("identity_password_accounts");
      const account = await accounts.findOne({ loginId: input.email, status: { $in: ["ACTIVE", "PENDING_DELIVERY"] } }, { session, projection: { _id: 1 } });
      if (account) return null;
      const pending = await requests.findOne({ email: input.email, status: "PENDING" }, { session });
      if (pending) return null;
      const id = randomUUID();
      await requests.insertOne({
        id,
        fullName: input.fullName,
        email: input.email,
        status: "PENDING",
        finalDecision: null,
        notificationStatus: "PENDING",
        processingUntil,
        approvalTokenHash: null,
        approvalExpiresAt: new Date(now.getTime() + 60 * 60_000),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }, { session });
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: now.toISOString(), actor: input.email,
        action: "ACCOUNT_REQUEST_SUBMITTED",
        subject: id, reason: "A Gmail address requested a demo employee account; owner review is pending.",
      }, { session });
      return id;
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      return { status: "RECEIVED" as const };
    throw error;
  }
  if (!requestId) return { status: "RECEIVED" as const };

  const notice = { id: requestId, fullName: input.fullName, email: input.email };
  const deliver = async () => {
    if (processingUntil.getTime() <= Date.now()) return;
    let result: "SENT" | "FAILED" = "SENT";
    try {
      await sendAccountRequestNotice(notice);
    } catch {
      result = "FAILED";
    }
    // If recording fails, the saved request becomes retryable when its lease expires.
    await finishRequestNotice(notice.id, processingUntil, input.email, result).catch(() => undefined);
  };
  if (scheduleNotice) {
    scheduleNotice(deliver);
  } else {
    await deliver();
  }
  return { status: "RECEIVED" as const };
}

async function finishRequestNotice(requestId: string, processingUntil: Date, actor: string, notificationStatus: "SENT" | "FAILED") {
  const now = new Date().toISOString();
  await identityTransaction(async (transactionDb, session) => {
    const updated = await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING", finalDecision: null, processingUntil }, {
      $set: { notificationStatus, updatedAt: now }, $unset: { processingUntil: "" },
    }, { session });
    if (!updated.modifiedCount) throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Tải lại danh sách.", 409);
    await transactionDb.collection("identity_audit").insertOne({
      id: randomUUID(), at: now, actor,
      action: notificationStatus === "SENT" ? "ACCOUNT_REQUEST_NOTICE_ACCEPTED" : "ACCOUNT_REQUEST_NOTICE_UNCONFIRMED",
      subject: requestId,
      reason: notificationStatus === "SENT"
        ? "The SMTP server accepted the Admin notice; recipient mailbox delivery was not verified."
        : "The Admin notice delivery could not be confirmed; an Admin can retry the same request.",
    }, { session });
  });
}

export async function retryAccountRequestNotice(requestId: string, actor: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new SupportError("ACCOUNT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu cấp tài khoản.", 404);
  assertIdentityEmailConfigured();
  const request = await claimAccountRequestNotice(requestId, actor);
  try {
    await sendAccountRequestNotice({ id: request.id, fullName: request.fullName, email: request.email });
  } catch {
    await finishRequestNotice(request.id, request.processingUntil, actor, "FAILED").catch(() => undefined);
    throw new SupportError("ACCOUNT_REQUEST_EMAIL_FAILED", "Chưa xác nhận được email thông báo quản trị. Có thể thử gửi lại cùng yêu cầu.", 503);
  }
  try {
    await finishRequestNotice(request.id, request.processingUntil, actor, "SENT");
  } catch {
    throw new SupportError("ACCOUNT_REQUEST_EMAIL_UNCONFIRMED", "Máy chủ email có thể đã nhận thông báo. Hãy tải lại danh sách để kiểm tra trước khi gửi lại cùng yêu cầu.", 503);
  }
  return { status: "SENT" as const, email: request.email };
}

async function claimAccountRequestNotice(requestId: string, actor: string) {
  const now = new Date();
  const lease = new Date(now.getTime() + APPROVAL_PROCESSING_MS);
  return identityTransaction(async (transactionDb, session) => {
    const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
    const current = await requests.findOne({ id: requestId }, { session });
    if (!current) throw new SupportError("ACCOUNT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu cấp tài khoản.", 404);
    if (current.processingUntil && current.processingUntil > now)
      throw new SupportError("ACCOUNT_REQUEST_PROCESSING", "Yêu cầu này đang được xử lý. Hãy thử lại sau.", 409);
    if (current.status !== "PENDING" || current.finalDecision || current.notificationStatus === "SENT")
      throw new SupportError("ACCOUNT_REQUEST_ALREADY_DECIDED", "Chỉ có thể gửi lại thông báo cho yêu cầu chưa được quyết định.", 409);
    const claimed = await requests.updateOne({ id: requestId, status: "PENDING", finalDecision: null, notificationStatus: current.notificationStatus,
      $or: [{ processingUntil: { $exists: false } }, { processingUntil: { $lte: now } }] }, {
      $set: { notificationStatus: "PENDING", processingUntil: lease, updatedAt: now.toISOString() },
    }, { session });
    if (!claimed.modifiedCount)
      throw new SupportError("ACCOUNT_REQUEST_PROCESSING", "Yêu cầu này đang được xử lý. Hãy thử lại sau.", 409);
    await transactionDb.collection("identity_audit").insertOne({
      id: randomUUID(), at: now.toISOString(), actor,
      action: "ACCOUNT_REQUEST_NOTICE_RETRY_STARTED", subject: requestId,
      reason: "Admin requested another send of the existing account request notice.",
    }, { session });
    return { ...current, processingUntil: lease };
  });
}

function deliveryState(row: AccountRequest, now: Date) {
  if (row.processingUntil && row.processingUntil > now)
    return { status: "PROCESSING", retryAction: null } as const;
  if (row.status === "APPROVED" && row.notificationStatus === "SENT")
    return { status: row.finalDecision === "REJECTED" ? "REJECTED" : "ISSUED", retryAction: null } as const;
  if (row.finalDecision === "APPROVED")
    return { status: "DELIVERY_FAILED", retryAction: "APPROVE" } as const;
  if (row.finalDecision === "REJECTED")
    return { status: "REJECTION_DELIVERY_FAILED", retryAction: "REJECT" } as const;
  if (row.notificationStatus !== "SENT")
    return { status: "ADMIN_NOTICE_FAILED", retryAction: "ADMIN_NOTICE" } as const;
  return { status: "PENDING", retryAction: null } as const;
}

export async function listAccountRequests(status: "pending" | "all", page: number) {
  const { db } = await identityStore();
  const now = new Date();
  const query: Filter<AccountRequest> = status === "pending" ? { $or: [
    { status: "PENDING" },
    { status: "APPROVED", finalDecision: { $in: ["APPROVED", "REJECTED"] }, notificationStatus: { $in: ["FAILED", "PENDING"] } },
  ] } : {};
  const rows = await db.collection<AccountRequest>("identity_account_requests").find(query, {
    projection: { _id: 0, id: 1, fullName: 1, email: 1, status: 1, finalDecision: 1, notificationStatus: 1, processingUntil: 1, createdAt: 1, updatedAt: 1 },
  }).sort({ createdAt: -1, id: 1 }).skip((page - 1) * 50).limit(51).toArray();
  return {
    items: rows.slice(0, 50).map((row) => ({
      id: row.id, fullName: row.fullName, email: row.email, createdAt: row.createdAt, updatedAt: row.updatedAt,
      ...deliveryState(row, now),
    })),
    hasMore: rows.length > 50,
  };
}

async function claimPendingRequest(requestId: string, actor: string, finalDecision: "APPROVED" | "REJECTED") {
  const now = new Date();
  const lease = new Date(now.getTime() + APPROVAL_PROCESSING_MS);
  return identityTransaction(async (transactionDb, session) => {
    const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
    const current = await requests.findOne({ id: requestId }, { session });
    if (!current) throw new SupportError("ACCOUNT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu cấp tài khoản.", 404);
    if (current.processingUntil && current.processingUntil > now)
      throw new SupportError("ACCOUNT_REQUEST_PROCESSING", "Yêu cầu này đang được xử lý. Hãy thử lại sau.", 409);

    const firstDecision = current.status === "PENDING" && !current.finalDecision;
    const retryingDelivery = current.finalDecision === finalDecision &&
      (current.notificationStatus === "FAILED" || current.notificationStatus === "PENDING");
    if (!firstDecision && !retryingDelivery)
      throw new SupportError("ACCOUNT_REQUEST_ALREADY_DECIDED", "Yêu cầu này đã được xử lý.", 409);

    const claimed = await requests.updateOne({ id: requestId, status: current.status, finalDecision: current.finalDecision ?? null, notificationStatus: current.notificationStatus,
      $or: [{ processingUntil: { $exists: false } }, { processingUntil: { $lte: now } }] }, {
      $set: {
        finalDecision,
        notificationStatus: "PENDING",
        processingUntil: lease,
        updatedAt: now.toISOString(),
      },
    }, { session });
    if (!claimed.modifiedCount)
      throw new SupportError("ACCOUNT_REQUEST_PROCESSING", "Yêu cầu này đang được xử lý. Hãy thử lại sau.", 409);

    if (finalDecision === "REJECTED") {
      await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne(
        { applicationId: requestId, status: "PENDING_DELIVERY" },
        { $set: { status: "DISABLED", updatedAt: now.toISOString() }, $unset: { credentialEnvelope: "" } },
        { session },
      );
    }
    await transactionDb.collection("identity_audit").insertOne({
      id: randomUUID(), at: now.toISOString(), actor,
      action: retryingDelivery
        ? finalDecision === "APPROVED" ? "ACCOUNT_CREDENTIAL_EMAIL_RETRY_STARTED" : "ACCOUNT_REJECTION_EMAIL_RETRY_STARTED"
        : finalDecision === "APPROVED" ? "ACCOUNT_APPROVAL_STARTED" : "ACCOUNT_REJECTION_STARTED",
      subject: requestId,
      reason: finalDecision === "APPROVED"
        ? "Admin approved the request; credentials remain inactive until SMTP acceptance and database activation are confirmed."
        : "Admin rejected the request; a notice will be emailed.",
    }, { session });
    return { ...current, finalDecision, processingUntil: lease };
  });
}

export async function decideAccountRequest(requestId: string, decision: "APPROVE" | "REJECT", actor: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new SupportError("ACCOUNT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu cấp tài khoản.", 404);
  assertIdentityEmailConfigured();
  if (decision === "REJECT") return rejectAccountRequest(requestId, actor);
  try {
    assertIdentityCredentialEncryptionConfigured();
  } catch {
    throw new SupportError("IDENTITY_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED", "Chưa cấu hình khóa mã hóa credential. Hãy liên hệ quản trị viên.", 503);
  }
  return approveAccountRequest(requestId, actor);
}

type ClaimedDecision = Awaited<ReturnType<typeof claimPendingRequest>>;

function decisionFilter(request: ClaimedDecision) {
  return { id: request.id, status: request.status, finalDecision: request.finalDecision, processingUntil: request.processingUntil };
}

function changedRequest() {
  return new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Tải lại danh sách.", 409);
}

async function recordDecisionFailure(request: ClaimedDecision, actor: string, action: string, reason: string) {
  await identityTransaction(async (db, session) => {
    const at = new Date().toISOString();
    const result = await db.collection<AccountRequest>("identity_account_requests").updateOne(decisionFilter(request), {
      $set: { notificationStatus: "FAILED", updatedAt: at }, $unset: { processingUntil: "" },
    }, { session });
    if (!result.matchedCount) throw changedRequest();
    await db.collection("identity_audit").insertOne({ id: randomUUID(), at, actor, action, subject: request.id, reason }, { session });
  });
}

async function rejectAccountRequest(requestId: string, actor: string) {
  const request = await claimPendingRequest(requestId, actor, "REJECTED");
  try {
    await sendAccountRequestRejected({ id: request.id, fullName: request.fullName, email: request.email });
  } catch {
    await recordDecisionFailure(request, actor, "ACCOUNT_REJECTION_EMAIL_UNCONFIRMED",
      "The rejection notice delivery could not be confirmed. An Admin can retry the same decision.");
    throw new SupportError("ACCOUNT_OUTCOME_EMAIL_FAILED", "Chưa xác nhận được email từ chối. Yêu cầu đã khóa quyết định từ chối và có thể thử gửi lại.", 503);
  }

  try {
    await identityTransaction(async (db, session) => {
      const at = new Date().toISOString();
      const completed = await db.collection<AccountRequest>("identity_account_requests").updateOne(decisionFilter(request), {
        $set: { status: "APPROVED", notificationStatus: "SENT", approvalTokenHash: null, updatedAt: at },
        $unset: { processingUntil: "" },
      }, { session });
      if (!completed.matchedCount) throw changedRequest();
      await db.collection("identity_audit").insertOne({
        id: randomUUID(), at, actor, action: "ACCOUNT_REJECTED", subject: request.id,
        reason: "The SMTP server accepted the rejection notice. Recipient mailbox delivery was not verified.",
      }, { session });
    });
  } catch {
    throw new SupportError("ACCOUNT_OUTCOME_EMAIL_UNCONFIRMED", "Máy chủ email có thể đã nhận thông báo. Hãy tải lại danh sách để kiểm tra trước khi thử lại cùng quyết định.", 503);
  }
  return { status: "REJECTED" as const, email: request.email };
}

async function prepareCredentials(request: ClaimedDecision, actor: string) {
  return identityTransaction(async (db, session) => {
    const current = await db.collection<AccountRequest>("identity_account_requests").findOne(decisionFilter(request), { session, projection: { _id: 1 } });
    if (!current) throw changedRequest();
    const accounts = db.collection<PasswordAccount>("identity_password_accounts");
    const existing = await accounts.findOne({ loginId: request.email }, { session });
    if (existing && (existing.applicationId !== request.id || existing.status !== "PENDING_DELIVERY"))
      throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);

    if (existing) {
      const hasEnvelope = Object.hasOwn(existing, "credentialEnvelope");
      // A modern pending account and its preparation audit were committed together.
      const preparedWithEnvelope = hasEnvelope || await db.collection("identity_audit").findOne({
        subject: request.id, action: { $in: ["ACCOUNT_CREDENTIAL_PREPARED", "ACCOUNT_CREDENTIAL_REPLACED"] },
      }, { session, projection: { _id: 1 } });
      if (preparedWithEnvelope)
        return recoverCredentials(existing);
    }

    const password = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const credentialEnvelope = encryptTemporaryPassword(password);
    const at = new Date().toISOString();
    const accountId = existing?.id ?? randomUUID();
    if (existing) {
      // Pre-envelope versions cannot recover the original password from its hash.
      const updated = await accounts.updateOne(
        { id: existing.id, applicationId: request.id, status: "PENDING_DELIVERY", passwordHash: existing.passwordHash, credentialEnvelope: { $exists: false } },
        { $set: { passwordHash, credentialEnvelope, updatedAt: at } }, { session },
      );
      if (!updated.matchedCount) throw changedRequest();
    } else {
      await accounts.insertOne({
        id: accountId, loginId: request.email, email: request.email, fullName: request.fullName,
        passwordHash, role: "requester", kind: "employee", status: "PENDING_DELIVERY",
        applicationId: request.id, credentialEnvelope, createdAt: at, updatedAt: at,
      }, { session });
    }
    await db.collection("identity_audit").insertOne({
      id: randomUUID(), at, actor, subject: request.id,
      action: existing ? "ACCOUNT_CREDENTIAL_REPLACED" : "ACCOUNT_CREDENTIAL_PREPARED",
      reason: existing
        ? "The legacy inactive account had no encrypted retry copy. A replacement was saved before sending."
        : "A password hash and encrypted retry copy were stored before attempting email delivery.",
    }, { session });
    return { accountId, password, passwordHash };
  });
}

async function recoverCredentials(account: PasswordAccount) {
  try {
    if (!account.credentialEnvelope) throw new Error("Empty credential envelope");
    const password = decryptTemporaryPassword(account.credentialEnvelope);
    if (!/^\d{5}$/.test(password) || !await bcrypt.compare(password, account.passwordHash))
      throw new Error("Credential does not match the pending hash");
    return { accountId: account.id, password, passwordHash: account.passwordHash };
  } catch {
    throw new SupportError("ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED",
      "Chưa khôi phục được mật khẩu đã lưu. Kiểm tra khóa mã hóa và bản sao lưu trước khi gửi lại. Tài khoản vẫn chờ kích hoạt.", 503);
  }
}

async function approveAccountRequest(requestId: string, actor: string) {
  const request = await claimPendingRequest(requestId, actor, "APPROVED");
  let credential: Awaited<ReturnType<typeof prepareCredentials>>;
  try {
    credential = await prepareCredentials(request, actor);
  } catch (error) {
    if (error instanceof SupportError && error.code === "ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED") {
      await recordDecisionFailure(request, actor, "ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED",
        "The stored retry copy could not be verified. The hash and encrypted copy are preserved for recovery.");
    } else if (isDuplicateKeyError(error) || (error instanceof SupportError && error.code === "ACCOUNT_ALREADY_ACTIVE")) {
      await recordDecisionFailure(request, actor, "ACCOUNT_APPROVAL_CONFLICT",
        "The login ID or application ID is already assigned. No credential was sent.");
      throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
    }
    throw error;
  }

  try {
    await sendIssuedCredentials({ email: request.email, fullName: request.fullName, password: credential.password });
  } catch {
    await recordDecisionFailure(request, actor, "ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED",
      "The account remains inactive and keeps its encrypted retry copy. An Admin can resend the same credential.");
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_FAILED", "Chưa xác nhận được email thông tin đăng nhập. Tài khoản vẫn chưa hoạt động, lần thử lại sẽ dùng cùng mật khẩu.", 503);
  }

  try {
    await identityTransaction(async (db, session) => {
      const at = new Date().toISOString();
      const completed = await db.collection<AccountRequest>("identity_account_requests").updateOne(decisionFilter(request), {
        $set: { status: "APPROVED", notificationStatus: "SENT", approvedAt: at, accountId: credential.accountId, approvalTokenHash: null, updatedAt: at },
        $unset: { processingUntil: "" },
      }, { session });
      if (!completed.matchedCount) throw changedRequest();
      const activated = await db.collection<PasswordAccount>("identity_password_accounts").updateOne({
        id: credential.accountId, applicationId: request.id, status: "PENDING_DELIVERY", passwordHash: credential.passwordHash,
      }, { $set: { status: "ACTIVE", updatedAt: at }, $unset: { credentialEnvelope: "" } }, { session });
      if (!activated.matchedCount) throw changedRequest();
      await db.collection("identity_audit").insertOne({
        id: randomUUID(), at, actor, action: "ACCOUNT_APPROVED", subject: request.id,
        reason: "The SMTP server accepted the credentials and this transaction activated the account.",
      }, { session });
    });
  } catch {
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED", "Máy chủ email có thể đã nhận thông tin đăng nhập. Hãy tải lại danh sách để kiểm tra trạng thái kích hoạt trước khi gửi lại cùng mật khẩu.", 503);
  }
  return { status: "APPROVED" as const, email: request.email };
}
