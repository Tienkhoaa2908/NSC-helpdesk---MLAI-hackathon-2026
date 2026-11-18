import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { passwordLoginSchema, type PasswordAccount } from "@/domain/password-identity";
import { configuredAdminId, identityClientRateLimitKey, identityRateLimit, createPasswordSession, recordPasswordLoginFailure } from "@/lib/identity-auth";
import { identityStore } from "@/lib/identity-store";
import { SupportError } from "@/lib/support-repository";

const demoLoginId = "guest01";
let demoHash: Promise<string> | undefined;
let dummyHash: Promise<string> | undefined;

function sameSecret(expected: string, supplied: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function ensureDemoRequester() {
  const { db } = await identityStore();
  demoHash ??= bcrypt.hash("12345", 12);
  await db.collection<PasswordAccount>("identity_password_accounts").updateOne({ loginId: demoLoginId }, {
    $setOnInsert: {
      id: randomUUID(), loginId: demoLoginId, email: "guest01@example.invalid", fullName: "Tài khoản trải nghiệm",
      passwordHash: await demoHash, role: "requester", kind: "demo", status: "ACTIVE",
      applicationId: "public-demo-guest01", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  }, { upsert: true });
}

export async function authenticatePasswordAccount(value: unknown, request: Request) {
  const input = passwordLoginSchema.parse(value);
  const clientKey = identityClientRateLimitKey(request);
  await identityRateLimit(`login:client:${clientKey}`, 30);
  await identityRateLimit(`login:account:${input.employeeId}`, 5, 15 * 60_000);

  const adminId = configuredAdminId();
  const adminPassword = process.env.IDENTITY_ADMIN_PASSWORD ?? "";
  if (adminId && input.employeeId === adminId && adminPassword.length >= 12 && sameSecret(adminPassword, input.password)) {
    const email = process.env.IDENTITY_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const token = await createPasswordSession({ principalType: "identity-admin", id: adminId, loginId: adminId, email, name: "Quản trị viên" });
    return { token, status: "ADMIN" as const, redirectTo: allowlistedAdminNext(input.next) };
  }

  if (input.employeeId === demoLoginId) await ensureDemoRequester();
  const { db } = await identityStore();
  const account = await db.collection<PasswordAccount>("identity_password_accounts").findOne({ loginId: input.employeeId }, { projection: { _id: 0 } });
  dummyHash ??= bcrypt.hash("not-a-real-account-password", 12);
  const validPassword = await bcrypt.compare(input.password, account?.passwordHash ?? await dummyHash);
  if (!account || account.status !== "ACTIVE" || account.role !== "requester" || !validPassword) {
    await recordPasswordLoginFailure();
    throw new SupportError("INVALID_CREDENTIALS", "ID nhân viên hoặc mật khẩu không chính xác.", 401);
  }
  await db.collection<PasswordAccount>("identity_password_accounts").updateOne({ id: account.id, status: "ACTIVE" }, { $set: { lastLoginAt: new Date().toISOString() } });
  const token = await createPasswordSession({ principalType: "requester", id: account.loginId, loginId: account.loginId,
    email: account.kind === "demo" ? null : account.email, name: account.fullName, accountId: account.id });
  return { token, status: "ACTIVE" as const, redirectTo: "/send-help" };
}

export function allowlistedAdminNext(value: string | undefined) {
  const allowed = new Set(["/review", "/audit", "/verify", "/identity/review"]);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/review";
  const parsed = URL.parse(value, "https://local.invalid");
  if (!parsed || parsed.origin !== "https://local.invalid" || parsed.search || parsed.hash || !allowed.has(parsed.pathname)) return "/review";
  return parsed.pathname;
}
