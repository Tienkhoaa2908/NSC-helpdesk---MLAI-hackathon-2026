import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoServerError } from "mongodb";
import { accountRequestSchema, type AccountRequest, type PasswordAccount } from "@/domain/password-identity";
import { identityStore, identityTransaction } from "@/lib/identity-store";
import { assertIdentityEmailConfigured, sendAccountRequestNotice, sendIssuedCredentials } from "@/lib/identity-mailer";
import { SupportError } from "@/lib/support-repository";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const APPROVAL_LIFETIME_MS = 60 * 60_000;
const APPROVAL_PROCESSING_MS = 2 * 60_000;
const isDuplicateKeyError = (error: unknown) => typeof error === "object" && error !== null &&
  "code" in error && (error as { code?: unknown }).code === 11000;

export async function submitAccountRequest(value: unknown) {
  const input = accountRequestSchema.parse(value);
  assertIdentityEmailConfigured();
  const { db } = await identityStore();
  const accounts = db.collection<PasswordAccount>("identity_password_accounts");
  if (await accounts.findOne({ loginId: input.email, status: "ACTIVE" }, { projection: { _id: 1 } }))
    throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Địa chỉ Gmail này đã có tài khoản. Hãy đăng nhập bằng ID và mật khẩu.", 409);

  const approvalToken = randomBytes(32).toString("hex");
  const approvalTokenHash = digest(approvalToken);
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
          fullName: input.fullName, approvalTokenHash, approvalExpiresAt: new Date(now.getTime() + APPROVAL_LIFETIME_MS),
          notificationStatus: "PENDING", updatedAt: now.toISOString(),
        }, $unset: { processingUntil: "" } }, { session });
        if (!changed.modifiedCount) throw new SupportError("ACCOUNT_REQUEST_CHANGED", "Yêu cầu đã thay đổi. Thử gửi lại.", 409);
      } else {
        id = randomUUID();
        await requests.insertOne({ id, fullName: input.fullName, email: input.email, status: "PENDING",
          notificationStatus: "PENDING", approvalTokenHash,
          approvalExpiresAt: new Date(now.getTime() + APPROVAL_LIFETIME_MS), createdAt: now.toISOString(), updatedAt: now.toISOString() }, { session });
      }
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: now.toISOString(), actor: input.email, action: pending ? "ACCOUNT_REQUEST_RESUBMITTED" : "ACCOUNT_REQUEST_SUBMITTED",
        subject: id, reason: "A Gmail address requested a demo employee account; owner approval is pending.",
      }, { session });
      return id;
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      throw new SupportError("ACCOUNT_REQUEST_EXISTS", "Email này đã có yêu cầu đang chờ xử lý.", 409);
    throw error;
  }

  try {
    await sendAccountRequestNotice({ id: requestId, fullName: input.fullName, email: input.email, approvalToken });
    await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING", approvalTokenHash }, {
      $set: { notificationStatus: "SENT", updatedAt: new Date().toISOString() },
    });
  } catch {
    await db.collection<AccountRequest>("identity_account_requests").updateOne({ id: requestId, status: "PENDING", approvalTokenHash }, {
      $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() },
    }).catch(() => undefined);
    throw new SupportError("ACCOUNT_REQUEST_EMAIL_FAILED", "Yêu cầu đã được lưu nhưng chưa gửi được email cho quản trị viên. Kiểm tra cấu hình email rồi thử lại.", 503);
  }
  return { id: requestId, status: "PENDING" as const };
}

export async function listAccountRequests(status: "pending" | "all", page: number) {
  const { db } = await identityStore();
  const query = status === "pending" ? { status: "PENDING" as const } : {};
  const rows = await db.collection<AccountRequest>("identity_account_requests").find(query, {
    projection: { _id: 0, id: 1, fullName: 1, email: 1, status: 1, notificationStatus: 1, createdAt: 1, updatedAt: 1, approvedAt: 1 },
  }).sort({ createdAt: -1, id: 1 }).skip((page - 1) * 50).limit(51).toArray();
  return {
    items: rows.slice(0, 50).map(({ id, fullName, email, status, notificationStatus, createdAt, updatedAt }) => ({
      id, fullName, email,
      status: status === "APPROVED" ? "ISSUED" as const : notificationStatus === "FAILED" ? "DELIVERY_FAILED" as const : "PENDING" as const,
      createdAt, updatedAt,
    })),
    hasMore: rows.length > 50,
  };
}

export async function approveAccountRequest(approvalToken: string) {
  if (!/^[a-f0-9]{64}$/.test(approvalToken)) throw new SupportError("ACCOUNT_APPROVAL_INVALID", "Liên kết cấp tài khoản không hợp lệ hoặc đã hết hạn.", 404);
  assertIdentityEmailConfigured();
  const approvalTokenHash = digest(approvalToken);
  const { db } = await identityStore();
  const now = new Date();
  const initial = await db.collection<AccountRequest>("identity_account_requests").findOne({
    approvalTokenHash, status: "PENDING", approvalExpiresAt: { $gt: now },
  }, { projection: { _id: 0 } });
  if (!initial) throw new SupportError("ACCOUNT_APPROVAL_INVALID", "Liên kết cấp tài khoản không hợp lệ hoặc đã hết hạn.", 404);
  if (initial.processingUntil && initial.processingUntil > now)
    throw new SupportError("ACCOUNT_APPROVAL_PROCESSING", "Yêu cầu này đang được xử lý. Hãy chờ một chút rồi mở lại liên kết.", 409);

  const temporaryPassword = String(randomInt(10_000, 100_000));
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const accountId = randomUUID();
  const lease = new Date(now.getTime() + APPROVAL_PROCESSING_MS);
  let account: PasswordAccount;
  try {
    account = await identityTransaction(async (transactionDb, session) => {
      const requests = transactionDb.collection<AccountRequest>("identity_account_requests");
      const current = await requests.findOne({ id: initial.id, approvalTokenHash, status: "PENDING", approvalExpiresAt: { $gt: now } }, { session });
      if (!current || (current.processingUntil && current.processingUntil > now))
        throw new SupportError("ACCOUNT_APPROVAL_INVALID", "Liên kết cấp tài khoản không hợp lệ, đã hết hạn hoặc đã được sử dụng.", 404);
      const accounts = transactionDb.collection<PasswordAccount>("identity_password_accounts");
      const existing = await accounts.findOne({ loginId: current.email }, { session });
      if (existing && (existing.applicationId !== current.id || existing.status !== "PENDING_DELIVERY"))
        throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
      const nextAccount: PasswordAccount = existing ? {
        ...existing, passwordHash, status: "PENDING_DELIVERY", updatedAt: now.toISOString(),
      } : {
        id: accountId, loginId: current.email, email: current.email, fullName: current.fullName,
        passwordHash, role: "requester", kind: "employee", status: "PENDING_DELIVERY",
        applicationId: current.id, createdAt: now.toISOString(), updatedAt: now.toISOString(),
      };
      if (existing) await accounts.updateOne({ id: existing.id, status: "PENDING_DELIVERY" }, {
        $set: { passwordHash, fullName: current.fullName, updatedAt: now.toISOString() },
      }, { session });
      else await accounts.insertOne(nextAccount, { session });
      const claimed = await requests.updateOne({ id: current.id, status: "PENDING", approvalTokenHash,
        $or: [{ processingUntil: { $exists: false } }, { processingUntil: { $lte: now } }] }, {
        $set: { processingUntil: lease, notificationStatus: "PENDING", updatedAt: now.toISOString() },
      }, { session });
      if (!claimed.modifiedCount) throw new SupportError("ACCOUNT_APPROVAL_PROCESSING", "Yêu cầu này đang được xử lý.", 409);
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: now.toISOString(), actor: "email-approval-link", action: "ACCOUNT_CREDENTIAL_DELIVERY_STARTED",
        subject: current.id, reason: "Owner used the single-use approval link; credential delivery is pending.",
      }, { session });
      return nextAccount;
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000)
      throw new SupportError("ACCOUNT_ALREADY_ACTIVE", "Email này đã được liên kết với một tài khoản khác.", 409);
    throw error;
  }

  try {
    await sendIssuedCredentials({ email: account.email, fullName: account.fullName, password: temporaryPassword });
  } catch {
    await identityTransaction(async (transactionDb, session) => {
      await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne({ id: account.id, status: "PENDING_DELIVERY" }, {
        $set: { status: "PENDING_DELIVERY", updatedAt: new Date().toISOString() },
      }, { session });
      await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({ id: initial.id, status: "PENDING", approvalTokenHash }, {
        $set: { notificationStatus: "FAILED", updatedAt: new Date().toISOString() }, $unset: { processingUntil: "" },
      }, { session });
      await transactionDb.collection("identity_audit").insertOne({
        id: randomUUID(), at: new Date().toISOString(), actor: "email-approval-link", action: "ACCOUNT_CREDENTIAL_DELIVERY_FAILED",
        subject: initial.id, reason: "Credential email was not delivered; account remains disabled and the approval link can be retried.",
      }, { session });
    });
    throw new SupportError("ACCOUNT_CREDENTIAL_EMAIL_FAILED", "Chưa gửi được email thông tin đăng nhập. Tài khoản chưa được kích hoạt; hãy thử lại bằng liên kết này.", 503);
  }

  await identityTransaction(async (transactionDb, session) => {
    const activated = await transactionDb.collection<PasswordAccount>("identity_password_accounts").updateOne({
      id: account.id, status: "PENDING_DELIVERY", passwordHash,
    }, { $set: { status: "ACTIVE", updatedAt: new Date().toISOString() } }, { session });
    const completed = await transactionDb.collection<AccountRequest>("identity_account_requests").updateOne({
      id: initial.id, status: "PENDING", approvalTokenHash,
    }, { $set: { status: "APPROVED", notificationStatus: "SENT", approvedAt: new Date().toISOString(), accountId: account.id,
      updatedAt: new Date().toISOString(), approvalTokenHash: null }, $unset: { processingUntil: "" } }, { session });
    if (!activated.modifiedCount || !completed.modifiedCount)
      throw new SupportError("ACCOUNT_APPROVAL_CHANGED", "Yêu cầu đã thay đổi. Kiểm tra trạng thái trước khi thử lại.", 409);
    await transactionDb.collection("identity_audit").insertOne({
      id: randomUUID(), at: new Date().toISOString(), actor: "email-approval-link", action: "ACCOUNT_APPROVED",
      subject: initial.id, reason: "Requester account was activated after credential email delivery.",
    }, { session });
  });
  return { status: "APPROVED" as const, email: initial.email };
}
