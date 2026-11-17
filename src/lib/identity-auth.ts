import { randomBytes } from "node:crypto";
import { type EmployeeAccount } from "@/domain/identity";
import { identityStore, identityTransaction } from "./identity-store";
import { identityAudit, identityHash } from "@/services/identity";
import { SupportError } from "./support-repository";
import type { VerifiedGoogleIdentity } from "./google-oidc";

export const identityCookie = "vng_identity";
const SESSION_LIFETIME_MS = 8 * 60 * 60_000;
type IdentitySession = {
  hash: string; googleSub: string; email: string; name: string; createdAt: Date; expiresAt: Date;
};
export type IdentityPrincipal = {
  status: "ACTIVE" | "PENDING" | "ADMIN";
  googleSub: string;
  email: string;
  name: string;
  assurance: "verified";
  canReviewIds: boolean;
  applicationStatus?: "PENDING" | "ID_CONFLICT" | "APPROVED" | "REJECTED";
  employee?: EmployeeAccount;
};

export function identityAdminEmails() {
  return (process.env.IDENTITY_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}
export function isIdentityAdminEmail(email: string) {
  const allowlist = identityAdminEmails();
  return allowlist.length > 0 && allowlist.includes(email.trim().toLowerCase());
}

export function identityClientRateLimitKey(request: Request) {
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (process.env.NODE_ENV === "production" && !vercelIp)
    throw new SupportError("CLIENT_IP_UNAVAILABLE", "Không thể giới hạn tốc độ đăng nhập an toàn. Thử lại sau.", 503);
  const localIp = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `client:${identityHash(vercelIp || localIp)}`;
}

export async function identityRateLimit(key: string, limit: number) {
  const { db } = await identityStore();
  const minute = Math.floor(Date.now() / 60_000);
  const result = await db.collection<{ key: string; count: number; expiresAt: Date }>("identity_limits").findOneAndUpdate(
    { key: `${identityHash(key)}:${minute}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60_000) } }, { upsert: true, returnDocument: "after" },
  );
  if (!result || result.count > limit) throw new SupportError("RATE_LIMITED", "Quá nhiều lần thử. Chờ một phút rồi thử lại.", 429);
}

export async function createIdentitySession(google: VerifiedGoogleIdentity) {
  const token = randomBytes(32).toString("hex");
  await identityTransaction(async (db, session) => {
    const existing = await db.collection<EmployeeAccount>("identity_employees").findOne({ googleSub: google.sub }, { session });
    if (existing?.status === "DISABLED")
      throw new SupportError("IDENTITY_DISABLED", "Tài khoản nhân viên đã bị vô hiệu hóa. Liên hệ quản trị viên.", 403);
    await db.collection<IdentitySession>("identity_sessions").insertOne({
      hash: identityHash(token), googleSub: google.sub, email: google.email, name: google.name,
      createdAt: new Date(), expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    }, { session });
    await identityAudit(db, session, google.email, "GOOGLE_LOGIN_SUCCEEDED", google.email, "Google OIDC xác minh tài khoản và email; không lưu access/refresh token.");
  });
  return token;
}

export async function recordGoogleLoginFailure() {
  try {
    await identityTransaction(async (db, session) => {
      await identityAudit(db, session, "google-oauth", "GOOGLE_LOGIN_FAILED", "google-oauth", "Google OIDC validation failed; no application session was issued.");
    });
  } catch {
    // Authentication failures stay generic when the audit database is unavailable.
  }
}

export function sessionToken(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${identityCookie}=`))?.slice(identityCookie.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function identityPrincipalForRequest(request: Request): Promise<IdentityPrincipal> {
  const token = sessionToken(request);
  if (!token) throw new SupportError("AUTHENTICATION_REQUIRED", "Đăng nhập bằng Google để tiếp tục.", 401);
  const { db } = await identityStore();
  const session = await db.collection<IdentitySession>("identity_sessions").findOne({
    hash: identityHash(token), expiresAt: { $gt: new Date() },
  }, { projection: { _id: 0 } });
  if (!session || typeof session.googleSub !== "string" || !session.googleSub || typeof session.email !== "string" || !session.email)
    throw new SupportError("AUTHENTICATION_REQUIRED", "Phiên đã hết hạn hoặc không còn hợp lệ. Đăng nhập lại bằng Google.", 401);

  const employee = await db.collection<EmployeeAccount>("identity_employees").findOne({ googleSub: session.googleSub }, { projection: { _id: 0 } });
  if (employee?.status === "DISABLED" && !isIdentityAdminEmail(session.email))
    throw new SupportError("AUTHENTICATION_REQUIRED", "Tài khoản nhân viên đã bị vô hiệu hóa. Liên hệ quản trị viên.", 401);
  const canReviewIds = isIdentityAdminEmail(session.email);
  const application = await db.collection<{ status: IdentityPrincipal["applicationStatus"] }>("identity_applications").findOne(
    { "applicant.sub": session.googleSub }, { projection: { _id: 0, status: 1 }, sort: { createdAt: -1 } },
  );
  const status: IdentityPrincipal["status"] = canReviewIds ? "ADMIN" : employee?.status === "ACTIVE" ? "ACTIVE" : "PENDING";
  return {
    status, googleSub: session.googleSub, email: session.email,
    name: employee?.fullName ?? session.name, assurance: "verified", canReviewIds,
    applicationStatus: application?.status,
    ...(status === "ACTIVE" && employee ? { employee } : {}),
  };
}

export async function requireIdentitySession(request: Request, admin: true): Promise<{ principal: IdentityPrincipal; assurance: "verified" }>;
export async function requireIdentitySession(request: Request, admin?: false): Promise<{ employee: EmployeeAccount; principal: IdentityPrincipal; assurance: "verified" }>;
export async function requireIdentitySession(request: Request, admin = false) {
  const principal = await identityPrincipalForRequest(request);
  if (admin) {
    if (!principal.canReviewIds)
      throw new SupportError("IT_AUTHORITY_REQUIRED", "Tài khoản Google chưa nằm trong danh sách quản trị danh tính.", 403);
    return { principal, assurance: "verified" as const };
  }
  if (principal.status !== "ACTIVE" || !principal.employee)
    throw new SupportError("ACTIVE_EMPLOYEE_REQUIRED", "Chỉ nhân viên đã được quản trị viên duyệt mới có quyền này.", 403);
  return { employee: principal.employee, principal, assurance: "verified" as const };
}

export async function logoutIdentity(request: Request) {
  const token = sessionToken(request);
  if (token) {
    try {
      await identityTransaction(async (db, transaction) => {
        const sessions = db.collection<IdentitySession>("identity_sessions");
        const session = await sessions.findOne({ hash: identityHash(token) }, { session: transaction });
        if (!session) return;
        await sessions.deleteOne({ hash: identityHash(token) }, { session: transaction });
        await identityAudit(db, transaction, session.email, "SESSION_REVOKED", session.email, "User signed out; opaque application session revoked.");
      });
    } catch {
      // The API still clears the browser cookie when storage is unavailable.
    }
  }
}
export function identitySessionCookie(token: string, clear = false) {
  return `${identityCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : Math.floor(SESSION_LIFETIME_MS / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
