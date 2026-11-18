import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoServerError, type Filter } from "mongodb";
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

export async function submitAccountRequest(value: unknown) {
  const input = accountRequestSchema.parse(value);
  const { db } = await identityStore();
  const accounts = db.collection<PasswordAccount>("identity_password_accounts");
  if (await accounts.findOne({ loginId: input.email, status: "ACTIVE" }, { projection: { _id: 1 } }))
    return { status: "RECEIVED" as const };

  const now = new Date();
  let requestId: string | null;
  const processingUntil = new Date(now.getTime() + APPROVAL_PROCESSING_MS);
  try {
    requestId = await identityTransaction(async (transactionDb, session) => {
      const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
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

  try {
    await sendAccountRequestNotice({ id: requestId, fullName: input.fullName, email: input.email });
  } catch {
    await finishRequestNotice(requestId, input.email, "FAILED").catch(() => undefined);
    return { status: "RECEIVED" as const };
  }
  try {
    await finishRequestNotice(requestId, input.email, "SENT");
  } catch {
    return { status: "RECEIVED" as const };
  }
  return { status: "RECEIVED" as const };
}

async function finishRequestNotice(requestId: string, actor: string, notificationStatus: "SENT" | "FAILED") {
  const now = new Date().toISOString();
  await identityTransaction(async (transactionDb, session) => {
    const updated = await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING", finalDecision: null }, {
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
    await finishRequestNotice(request.id, actor, "FAILED").catch(() => undefined);
    throw new SupportError("ACCOUNT_REQUEST_EMAIL_FAILED", "Chưa xác nhận được email thông báo quản trị. Có thể thử gửi lại cùng yêu cầu.", 503);
  }
  try {
    await finishRequestNotice(request.id, actor, "SENT");
  } catch {
    throw new SupportError("ACCOUNT_REQUEST_EMAIL_UNCONFIRMED", "Máy chủ email có thể đã nhận thông báo. Trạng thái sẽ được cập nhật sau khi lưu được, hãy thử lại cùng yêu cầu nếu cần.", 503);
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
    const claimed = await requests.updateOne({ id: requestId, status: "PENDING",
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
    return current;
  });
}

export async function listAccountRequests(status: "pending" | "all", page: number) {
  const { db } = await identityStore();
  const now = new Date();
  const query: Filter<AccountRequest> = status === "pending"
    ? { $or: [
        { status: "PENDING" },
        { status: "APPROVED", finalDecision: "APPROVED", $or: [
          { notificationStatus: "FAILED" },
          { notificationStatus: "PENDING", processingUntil: { $exists: true } },
        ] },
        { status: "APPROVED", finalDecision: "REJECTED", $or: [
          { notificationStatus: "FAILED" },
          { notificationStatus: "PENDING", processingUntil: { $exists: true } },
        ] },
      ] }
    : {};
  const rows = await db.collection<AccountRequest>("identity_account_requests").find(query, {
    projection: { _id: 0, id: 1, fullName: 1, email: 1, status: 1, finalDecision: 1, notificationStatus: 1, processingUntil: 1, createdAt: 1, updatedAt: 1, approvedAt: 1 },
  }).sort({ createdAt: -1, id: 1 }).skip((page - 1) * 50).limit(51).toArray();
  return {
    items: rows.slice(0, 50).map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.processingUntil && row.processingUntil > now
        ? "PROCESSING" as const
        : row.finalDecision === "REJECTED"
          ? row.status === "APPROVED" && row.notificationStatus === "SENT"
            ? "REJECTED" as const
            : row.notificationStatus === "FAILED" || (row.processingUntil && row.processingUntil <= now)
              ? "REJECTION_DELIVERY_FAILED" as const
              : "PENDING" as const
          : row.finalDecision === "APPROVED"
            ? row.status === "APPROVED" && row.notificationStatus === "SENT"
              ? "ISSUED" as const
              : row.notificationStatus === "FAILED" || row.notificationStatus === "PENDING" || (row.processingUntil && row.processingUntil <= now)
                ? "DELIVERY_FAILED" as const
                : "PENDING" as const
            : row.notificationStatus === "FAILED" || (row.notificationStatus === "PENDING" && row.processingUntil && row.processingUntil <= now)
              ? "ADMIN_NOTICE_FAILED" as const
              : "PENDING" as const,
      retryAction: row.finalDecision === "APPROVED"
        ? row.status === "APPROVED" && row.notificationStatus === "SENT" ? null : "APPROVE" as const
        : row.finalDecision === "REJECTED"
          ? row.status === "APPROVED" && row.notificationStatus === "SENT" ? null : "REJECT" as const
          : row.notificationStatus === "FAILED" || (row.notificationStatus === "PENDING" && row.processingUntil && row.processingUntil <= now)
            ? "ADMIN_NOTICE" as const
            : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

    const claimed = await requests.updateOne({ id: requestId, status: current.status,
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
    return current;
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

async function rejectAccountRequest(requestId: string, actor: string) {
  const request = await claimPendingRequest(requestId, actor, "REJECTED");
  const { db } = await identityStore();
  await db.collection<PasswordAccount>("identity_password_accounts").updateOne({ applicationId: request.id, status: "PENDING_DELIVERY" }, {
    $set: { status: "DISABLED", updatedAt: new Date().toISOString() },
  });

  try {
    await sendAccountRequestRejected({ id: request.id, fullName: request.fullName, email: request.email });
  } catch {
    await identityTransaction(async (transactionDb, transactionSession) => {
      await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "REJECTED" }, {
        $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
      }, { session: transactionSession });
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor,
        action: "ACCOUNT_REJECTION_EMAIL_UNCONFIRMED", subject: request.id,
        reason: "The rejection notice delivery could not be confirmed; an Admin can retry the same decision.",
      }, { session: transactionSession });
    });
    throw new SupportError("ACCOUNT_OUTCOME_EMAIL_FAILED", "Chưa xác nhận được email từ chối. Yêu cầu đã khóa quyết định từ chối và có thể thử gửi lại.", 503);
  }

  try {
    await identityTransaction(async (transactionDb, transactionSession) => {
      const completed = await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({
        id: request.id, status: request.status, finalDecision: "REJECTED",
      }, { $set: {
        status: "APPROVED",
        notificationStatus: "SENT",
        approvalTokenHash: null,
        updatedAt: new Date().toISOString(),
      }, $unset: { processingUntil: "" } }, { session: transactionSession });
      if (!completed.modifiedCount) throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Tải lại danh sách.", 409);
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor,
        action: "ACCOUNT_REJECTED", subject: request.id,
        reason: "The SMTP server accepted the rejection notice; recipient mailbox delivery was not verified.",
      }, { session: transactionSession });
    });
  } catch {
    throw new SupportError("ACCOUNT_OUTCOME_EMAIL_UNCONFIRMED", "Máy chủ email có thể đã nhận thông báo nhưng chưa lưu được trạng thái. Thử lại cùng quyết định để đồng bộ.", 503);
  }
  return { status: "REJECTED" as const, email: request.email };
}

async function approveAccountRequest(requestId: string, actor: string) {
  const request = await claimPendingRequest(requestId, actor, "APPROVED");
  const { db } = await identityStore();
  const accounts = db.collection<PasswordAccount>("identity_password_accounts");
  const existing = await accounts.findOne({ loginId: request.email });
  if (existing && (existing.applicationId !== request.id || existing.status !== "PENDING_DELIVERY")) {
    await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "APPROVED" }, {
      $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
    });
    throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
  }

  let temporaryPassword: string | undefined;
  let passwordHash: string | undefined;
  let credentialEnvelope = existing?.credentialEnvelope;
  let replacingCredential = false;
  if (credentialEnvelope) {
    try {
      temporaryPassword = decryptTemporaryPassword(credentialEnvelope);
      if (!/^\d{5}$/.test(temporaryPassword)) throw new Error("Stored temporary credential has an invalid format.");
      passwordHash = existing?.passwordHash;
    } catch {
      credentialEnvelope = undefined;
      replacingCredential = true;
    }
  } else if (existing) {
    replacingCredential = true;
  }
  if (!temporaryPassword) {
    temporaryPassword = generateTemporaryPassword();
    credentialEnvelope = encryptTemporaryPassword(temporaryPassword);
    passwordHash = await bcrypt.hash(temporaryPassword, 12);
  }
  if (!passwordHash || !credentialEnvelope)
    throw new SupportError("ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED", "Không thể chuẩn bị thông tin đăng nhập an toàn. Hãy thử lại sau khi kiểm tra cấu hình mã hóa.", 503);

  const now = new Date().toISOString();
  const account: PasswordAccount = existing ? {
    ...existing, passwordHash, credentialEnvelope, status: "PENDING_DELIVERY", updatedAt: now,
  } : {
    id: randomUUID(), loginId: request.email, email: request.email, fullName: request.fullName,
    passwordHash, role: "requester", kind: "employee", status: "PENDING_DELIVERY",
    applicationId: request.id, credentialEnvelope, createdAt: now, updatedAt: now,
  };
  try {
    await identityTransaction(async (transactionDb, session) => {
      const transactionAccounts = transactionDb.collection<PasswordAccount>("identity_password_accounts");
      if (existing && replacingCredential) {
        const updated = await transactionAccounts.updateOne({ id: existing.id, applicationId: request.id, status: "PENDING_DELIVERY" }, {
          $set: { passwordHash, credentialEnvelope, updatedAt: now },
        }, { session });
        if (!updated.modifiedCount) throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Tải lại danh sách.", 409);
      } else if (!existing) {
        await transactionAccounts.insertOne(account, { session });
      }
      if (!existing || replacingCredential) {
        await transactionDb.collection("identity_audit").insertOne({
          id: randomUUID(), at: now, actor,
          action: existing ? "ACCOUNT_CREDENTIAL_REPLACED" : "ACCOUNT_CREDENTIAL_PREPARED",
          subject: request.id,
          reason: existing
            ? "The inactive legacy credential could not be recovered; it was replaced before retrying delivery."
            : "A password hash and encrypted retry copy were stored before attempting email delivery.",
        }, { session });
      }
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      await identityTransaction(async (transactionDb, session) => {
        await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "APPROVED" }, {
          $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
        }, { session });
        await transactionDb.collection("identity_audit").insertOne({
          id: randomUUID(), at: new Date().toISOString(), actor,
          action: "ACCOUNT_APPROVAL_CONFLICT", subject: request.id,
          reason: "The unique login ID or application ID was already assigned to another account.",
        }, { session });
      });
      throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
    }
    throw error;
  }

  try {
    await sendIssuedCredentials({ email: account.email, fullName: account.fullName, password: temporaryPassword });
  } catch {
    await identityTransaction(async (transactionDb, transactionSession) => {
      await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne({ id: account.id, status: "PENDING_DELIVERY" }, {
        $set: { updatedAt: new Date().toISOString() },
      }, { session: transactionSession });
      await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "APPROVED" }, {
        $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
      }, { session: transactionSession });
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor,
        action: "ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED", subject: request.id,
        reason: "The account remains inactive and keeps the same encrypted retry credential; an Admin can resend it.",
      }, { session: transactionSession });
    });
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_FAILED", "Chưa xác nhận được email thông tin đăng nhập. Tài khoản vẫn chưa hoạt động, lần thử lại sẽ dùng cùng mật khẩu.", 503);
  }

  try {
    await identityTransaction(async (transactionDb, transactionSession) => {
      const activated = await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne({
        id: account.id, status: "PENDING_DELIVERY", passwordHash,
      }, { $set: { status: "ACTIVE", updatedAt: new Date().toISOString() }, $unset: { credentialEnvelope: "" } }, { session: transactionSession });
      const completed = await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({
        id: request.id, status: request.status, finalDecision: "APPROVED",
      }, { $set: {
        status: "APPROVED",
        notificationStatus: "SENT",
        approvedAt: new Date().toISOString(),
        accountId: account.id,
        approvalTokenHash: null,
        updatedAt: new Date().toISOString(),
      }, $unset: { processingUntil: "" } }, { session: transactionSession });
      if (!activated.modifiedCount || !completed.modifiedCount)
        throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Tải lại danh sách trước khi thử lại.", 409);
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor,
        action: "ACCOUNT_APPROVED", subject: request.id,
        reason: "The SMTP server accepted the credentials and the account was activated in the same database transaction.",
      }, { session: transactionSession });
    });
  } catch {
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED", "Email có thể đã được nhận nhưng chưa lưu được trạng thái. Tài khoản vẫn chưa hoạt động, hãy thử lại cùng mật khẩu.", 503);
  }
  return { status: "APPROVED" as const, email: request.email };
}
