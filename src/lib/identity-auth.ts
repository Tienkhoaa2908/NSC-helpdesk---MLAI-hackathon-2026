import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { type EmployeeAccount } from "@/domain/identity";
import type { PasswordAccount } from "@/domain/password-identity";
import { SupportError } from "./support-repository";
import { identityStore, identityTransaction } from "./identity-store";

export const identityCookie = "vng_identity";
const SESSION_LIFETIME_MS = 8 * 60 * 60_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

type IdentitySession = {
  hash: string;
  authMethod: "password";
  principalType: "requester" | "identity-admin";
  accountId?: string;
  id: string;
  loginId: string;
  email: string | null;
  name: string;
  adminCredentialHash?: string;
  createdAt: Date;
  expiresAt: Date;
};

export type IdentityPrincipal = {
  status: "ACTIVE" | "ADMIN";
  id: string;
  loginId: string;
  email: string | null;
  name: string;
  assurance: "password" | "test";
  canReviewIds: boolean;
  employee?: EmployeeAccount;
  isTestIdentity?: boolean;
  demoRequester?: boolean;
};

function constantTimeEqual(expected: string, supplied: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionToken(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${identityCookie}=`))?.slice(identityCookie.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function testPrincipal(request: Request): IdentityPrincipal | null {
  const configuredSecret = process.env.SUPPORT_E2E_IDENTITY_SECRET ?? "";
  const suppliedSecret = request.headers.get("x-support-e2e-identity") ?? "";
  const url = new URL(request.url);
  const role = request.headers.get("x-support-e2e-role");
  const isLoopbackHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const secretMatches = constantTimeEqual(configuredSecret, suppliedSecret);
  const validRole = role === "admin" || role === "requester";
  if (process.env.NODE_ENV !== "production" || process.env.SUPPORT_E2E_PRODUCTION !== "true" ||
      configuredSecret.length < 32 || !isLoopbackHost || url.port !== "3227" ||
      !secretMatches || !validRole) return null;
  const id = "EMP-E2E-001";
  const employee: EmployeeAccount = {
    id, department: "engineering", fullName: "Local E2E requester", status: "ACTIVE", profileId: "e2e-requester",
    profileVersion: 1, roles: [], applicationId: "e2e-requester", createdAt: new Date(0).toISOString(),
  };
  if (role === "admin") return {
    status: "ADMIN", id: "e2e-admin", loginId: "e2e-admin", email: "e2e-admin@example.invalid",
    name: "Local E2E administrator", assurance: "test", canReviewIds: true, employee, isTestIdentity: true,
  };
  return { status: "ACTIVE", id, loginId: id, email: null, name: employee.fullName, assurance: "test", canReviewIds: false, employee, isTestIdentity: true };
}

export async function identityPrincipalForRequest(request: Request): Promise<IdentityPrincipal> {
  const localTest = testPrincipal(request);
  if (localTest) return localTest;
  const token = sessionToken(request);
  if (!token) throw new SupportError("AUTHENTICATION_REQUIRED", "Đăng nhập bằng ID nhân viên và mật khẩu để tiếp tục.", 401);
  const { db } = await identityStore();
  const session = await db.collection<IdentitySession>("identity_sessions").findOne({
    hash: hash(token), authMethod: "password", expiresAt: { $gt: new Date() },
  }, { projection: { _id: 0 } });
  if (!session) throw new SupportError("AUTHENTICATION_REQUIRED", "Phiên đã hết hạn hoặc không còn hợp lệ. Đăng nhập lại bằng ID và mật khẩu.", 401);
  if (session.principalType === "identity-admin") {
    const adminId = process.env.IDENTITY_ADMIN_ID?.trim().toLowerCase() ?? "";
    const adminPassword = process.env.IDENTITY_ADMIN_PASSWORD ?? "";
    const currentCredentialHash = hash(`${adminId}\u0000${adminPassword}`);
    if (!adminId || !adminPassword || session.loginId !== adminId || session.adminCredentialHash !== currentCredentialHash)
      throw new SupportError("AUTHENTICATION_REQUIRED", "Phiên quản trị không còn hợp lệ. Đăng nhập lại.", 401);
    return { status: "ADMIN", id: session.id, loginId: session.loginId, email: session.email, name: session.name,
      assurance: "password", canReviewIds: true };
  }
  if (session.principalType !== "requester" || !session.accountId)
    throw new SupportError("AUTHENTICATION_REQUIRED", "Phiên đã hết hạn hoặc không còn hợp lệ. Đăng nhập lại.", 401);
  const account = await db.collection<PasswordAccount>("identity_password_accounts").findOne({ id: session.accountId, status: "ACTIVE", role: "requester" }, { projection: { _id: 0, passwordHash: 0 } });
  if (!account)
    throw new SupportError("AUTHENTICATION_REQUIRED", "Tài khoản chưa hoạt động hoặc đã bị vô hiệu hóa. Đăng nhập lại.", 401);
  const employee: EmployeeAccount = {
    id: account.loginId, fullName: account.fullName, email: account.email, status: "ACTIVE",
    profileId: account.kind === "demo" ? "demo-requester" : "employee-requester", profileVersion: 1,
    roles: [], applicationId: account.applicationId, createdAt: account.createdAt,
  };
  return { status: "ACTIVE", id: account.loginId, loginId: account.loginId, email: account.email, name: account.fullName,
    assurance: "password", canReviewIds: false, employee, demoRequester: account.kind === "demo" };
}

export async function createPasswordSession(input: {
  principalType: "requester" | "identity-admin";
  id: string;
  loginId: string;
  email: string | null;
  name: string;
  accountId?: string;
}) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const adminCredentialHash = input.principalType === "identity-admin"
    ? hash(`${process.env.IDENTITY_ADMIN_ID?.trim().toLowerCase() ?? ""}\u0000${process.env.IDENTITY_ADMIN_PASSWORD ?? ""}`)
    : undefined;
  await identityTransaction(async (db, mongoSession) => {
    await db.collection<IdentitySession>("identity_sessions").insertOne({
      hash: hash(token), authMethod: "password", principalType: input.principalType,
      id: input.id, loginId: input.loginId, email: input.email, name: input.name,
      ...(input.accountId ? { accountId: input.accountId } : {}),
      ...(adminCredentialHash ? { adminCredentialHash } : {}),
      createdAt: now, expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
    }, { session: mongoSession });
    await db.collection("identity_audit").insertOne({
      id: randomBytes(16).toString("hex"), at: now.toISOString(), actor: input.loginId,
      action: "PASSWORD_LOGIN_SUCCEEDED", subject: input.id,
      reason: input.principalType === "identity-admin" ? "Administrator signed in with configured server credentials." : "Requester signed in with an active password account.",
    }, { session: mongoSession });
  });
  return token;
}

export async function recordPasswordLoginFailure() {
  try {
    const { db } = await identityStore();
    await db.collection("identity_audit").insertOne({
      id: randomBytes(16).toString("hex"), at: new Date().toISOString(), actor: "password-login",
      action: "PASSWORD_LOGIN_FAILED", subject: "password-login", reason: "Credentials rejected.",
    });
  } catch {
    // Keep failures generic when the audit database is unavailable.
  }
}

export function identityClientRateLimitKey(request: Request) {
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (process.env.NODE_ENV === "production" && !vercelIp)
    throw new SupportError("CLIENT_IP_UNAVAILABLE", "Không thể giới hạn tốc độ đăng nhập an toàn. Thử lại sau.", 503);
  const localIp = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `client:${hash(vercelIp || localIp)}`;
}

export async function identityRateLimit(key: string, limit: number, windowMs = 60_000) {
  const { db } = await identityStore();
  const window = Math.floor(Date.now() / windowMs);
  const expiresAt = new Date((window + 1) * windowMs + windowMs);
  const result = await db.collection<{ key: string; count: number; expiresAt: Date }>("identity_limits").findOneAndUpdate(
    { key: `${hash(key)}:${windowMs}:${window}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, returnDocument: "after" },
  );
  if (!result || result.count > limit) throw new SupportError("RATE_LIMITED", "Quá nhiều lần thử. Chờ rồi thử lại.", 429);
}

export async function requireIdentitySession(request: Request, admin: true): Promise<{ principal: IdentityPrincipal; assurance: "password" | "test" }>;
export async function requireIdentitySession(request: Request, admin?: false): Promise<{ employee: EmployeeAccount; principal: IdentityPrincipal; assurance: "password" | "test" }>;
export async function requireIdentitySession(request: Request, admin = false) {
  const principal = await identityPrincipalForRequest(request);
  if (admin) {
    if (principal.status !== "ADMIN" || !principal.canReviewIds)
      throw new SupportError("IT_AUTHORITY_REQUIRED", "Tài khoản chưa có quyền quản trị hệ thống.", 403);
    return { principal, assurance: principal.assurance };
  }
  if (principal.status !== "ACTIVE" || !principal.employee)
    throw new SupportError("ACTIVE_EMPLOYEE_REQUIRED", "Đăng nhập bằng tài khoản nhân viên để gửi yêu cầu hỗ trợ.", 403);
  return { employee: principal.employee, principal, assurance: principal.assurance };
}

export async function logoutIdentity(request: Request) {
  const token = sessionToken(request);
  if (!token) return;
  try {
    const { db } = await identityStore();
    const session = await db.collection<IdentitySession>("identity_sessions").findOne({ hash: hash(token) }, { projection: { _id: 0 } });
    await db.collection<IdentitySession>("identity_sessions").deleteOne({ hash: hash(token) });
    if (session) await db.collection("identity_audit").insertOne({
      id: randomBytes(16).toString("hex"), at: new Date().toISOString(), actor: session.loginId,
      action: "SESSION_REVOKED", subject: session.id, reason: "User signed out; opaque application session revoked.",
    });
  } catch {
    // The browser cookie is still cleared if the session store is unavailable.
  }
}

export function identitySessionCookie(token: string, clear = false) {
  return `${identityCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : Math.floor(SESSION_LIFETIME_MS / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
