import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoServerError, type Filter } from "mongodb";
import { accountRequestSchema, type AccountRequest, type PasswordAccount } from "@/domain/password-identity";
import { identityStore, identityTransaction } from "@/lib/identity-store";
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
    throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Địa chỉ Gmail này đã có tài khoản. Hãy đăng nhập bằng ID và mật khẩu.", 409);

  const now = new Date();
  let requestId: string;
  try {
    requestId = await identityTransaction(async (transactionDb, session) => {
      const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
      const pending = await requests.findOne({ email: input.email, status: "PENDING" }, { session });
      let id: string;
      if (pending) {
        if (pending.processingUntil && pending.processingUntil > now)
          throw new SupportError("ACCOUNT_REQUEST_PROCESSING", "Yêu cầu này đang được xử lý. Thử lại sau.", 409);
        id = pending.id;
        const changed = await requests.updateOne({ id, status: "PENDING" }, { $set: {
          fullName: input.fullName,
          finalDecision: null,
          approvalTokenHash: null,
          approvalExpiresAt: new Date(now.getTime() + 60 * 60_000),
          notificationStatus: "PENDING",
          updatedAt: now.toISOString(),
        }, $unset: { processingUntil: "" } }, { session });
        if (!changed.modifiedCount) throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Thử gửi lại.", 409);
      } else {
        id = randomUUID();
        await requests.insertOne({
          id,
          fullName: input.fullName,
          email: input.email,
          status: "PENDING",
          finalDecision: null,
          notificationStatus: "PENDING",
          approvalTokenHash: null,
          approvalExpiresAt: new Date(now.getTime() + 60 * 60_000),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }, { session });
      }
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: now.toISOString(), actor: input.email,
        action: pending ? "ACCOUNT_REQUEST_RESUBMITTED" : "ACCOUNT_REQUEST_SUBMITTED",
        subject: id, reason: "A Gmail address requested a demo employee account; owner review is pending.",
      }, { session });
      return id;
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      throw new SupportError("ACCOUNT_REQUEST_EXISTS", "Email này đã có yêu cầu đang chờ xử lý.", 409);
    throw error;
  }

  try {
    await sendAccountRequestNotice({ id: requestId, fullName: input.fullName, email: input.email });
    await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING" }, {
      $set: { notificationStatus: "SENT", updatedAt: new Date().toISOString() },
    });
  } catch {
    await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING" }, {
      $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() },
    }).catch(() => undefined);
    return { id: requestId, status: "PENDING" as const, notificationStatus: "FAILED" as const };
  }
  return { id: requestId, status: "PENDING" as const, notificationStatus: "SENT" as const };
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
            : row.notificationStatus === "FAILED" ? "DELIVERY_FAILED" as const : "PENDING" as const,
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

    const retryingDelivery = current.status === "APPROVED" && current.finalDecision === finalDecision &&
      (current.notificationStatus === "FAILED" || current.notificationStatus === "PENDING");
    const isPending = current.status === "PENDING";
    if (!isPending && !retryingDelivery)
      throw new SupportError("ACCOUNT_REQUEST_ALREADY_DECIDED", "Yêu cầu này đã được xử lý.", 409);
    if (isPending && current.finalDecision && current.finalDecision !== finalDecision && current.notificationStatus !== "FAILED")
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
      action: finalDecision === "APPROVED" ? "ACCOUNT_APPROVAL_STARTED" : "ACCOUNT_REJECTION_STARTED",
      subject: requestId,
      reason: finalDecision === "APPROVED" ? "Admin approved the request; credentials will be emailed before activation." : "Admin rejected the account request; a notice will be emailed.",
    }, { session });
    return current;
  });
}

export async function decideAccountRequest(requestId: string, decision: "APPROVE" | "REJECT", actor: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new SupportError("ACCOUNT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu cấp tài khoản.", 404);
  assertIdentityEmailConfigured();
  if (decision === "REJECT") return rejectAccountRequest(requestId, actor);
  return approveAccountRequest(requestId, actor);
}

async function rejectAccountRequest(requestId: string, actor: string) {
  const request = await claimPendingRequest(requestId, actor, "REJECTED");
  const { db } = await identityStore();
  if (request.finalDecision === "APPROVED") {
    await db.collection<PasswordAccount>("identity_password_accounts").updateOne({ applicationId: request.id, status: "PENDING_DELIVERY" }, {
      $set: { status: "DISABLED", updatedAt: new Date().toISOString() },
    });
  }

  try {
    await sendAccountRequestRejected({ id: request.id, fullName: request.fullName, email: request.email });
  } catch {
    await identityTransaction(async (transactionDb, transactionSession) => {
      await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "REJECTED" }, {
        $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
      }, { session: transactionSession });
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor,
        action: "ACCOUNT_REJECTION_EMAIL_FAILED", subject: request.id,
        reason: "The rejection notice could not be delivered; an Admin can retry from the request list.",
      }, { session: transactionSession });
    });
    throw new SupportError("ACCOUNT_OUTCOME_EMAIL_FAILED", "Chưa gửi được email từ chối. Yêu cầu đã được giữ lại để quản trị viên thử gửi lại.", 503);
  }

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
      reason: "Admin rejected the request and the applicant notice was delivered.",
    }, { session: transactionSession });
  });
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

  const temporaryPassword = String(randomInt(10_000, 100_000));
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const now = new Date().toISOString();
  const account: PasswordAccount = existing ? {
    ...existing, passwordHash, status: "PENDING_DELIVERY", updatedAt: now,
  } : {
    id: randomUUID(), loginId: request.email, email: request.email, fullName: request.fullName,
    passwordHash, role: "requester", kind: "employee", status: "PENDING_DELIVERY",
    applicationId: request.id, createdAt: now, updatedAt: now,
  };
  if (existing) {
    await accounts.updateOne({ id: existing.id, status: "PENDING_DELIVERY" }, {
      $set: { passwordHash, fullName: request.fullName, updatedAt: now },
    });
  } else {
    try {
      await accounts.insertOne(account);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: request.id, status: request.status, finalDecision: "APPROVED" }, {
          $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
        });
        throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
      }
      throw error;
    }
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
        action: "ACCOUNT_CREDENTIAL_EMAIL_FAILED", subject: request.id,
        reason: "The account remains inactive; an Admin can retry credential delivery.",
      }, { session: transactionSession });
    });
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_FAILED", "Chưa gửi được email thông tin đăng nhập. Tài khoản chưa được kích hoạt; hãy thử lại từ danh sách yêu cầu.", 503);
  }

  await identityTransaction(async (transactionDb, transactionSession) => {
    const activated = await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne({
      id: account.id, status: "PENDING_DELIVERY", passwordHash,
    }, { $set: { status: "ACTIVE", updatedAt: new Date().toISOString() } }, { session: transactionSession });
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
      reason: "The employee account was activated after its credentials were delivered.",
    }, { session: transactionSession });
  });
  return { status: "APPROVED" as const, email: request.email };
}
