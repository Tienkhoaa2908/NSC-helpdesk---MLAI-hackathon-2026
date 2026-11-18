import { z } from "zod";
import { successResponse } from "@/lib/api-response";
import { identityClientRateLimitKey, identityPrincipalForRequest, identityRateLimit, identitySessionCookie, logoutIdentity, requireIdentitySession } from "@/lib/identity-auth";
import { identityStore } from "@/lib/identity-store";
import { supportApi, supportBody } from "@/lib/support-http";
import { SupportError } from "@/lib/support-repository";
import { authenticatePasswordAccount } from "@/services/password-auth";
import { decideAccountRequest, listAccountRequests, submitAccountRequest } from "@/services/account-requests";
import { mongoDemoAuthority, requestDemoGrant, decideDemoGrant, updateDemoUsage, checkDemoAuthority } from "@/services/demo-authority";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  const parsedOrigin = origin ? URL.parse(origin) : null;
  const sameOrigin = Boolean(parsedOrigin && parsedOrigin.origin === origin &&
    (origin === target.origin || parsedOrigin.host === request.headers.get("host") && parsedOrigin.protocol === target.protocol));
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site")
    throw new SupportError("INVALID_ORIGIN", "Origin không hợp lệ.", 403);
}

export async function GET(request: Request, context: Context) {
  return supportApi(async () => {
    const { path } = await context.params;
    const route = path.join("/");
    if (route === "session") {
      const principal = await identityPrincipalForRequest(request);
      // E2E browser journeys use a synthetic requester view on the session
      // endpoint; their API role remains ADMIN for reviewer authorization.
      const testRequesterView = principal.isTestIdentity && principal.status === "ADMIN" && principal.employee;
      return { status: testRequesterView ? "ACTIVE" : principal.status,
        id: testRequesterView ? principal.employee!.id : principal.id, name: principal.name, email: principal.email };
    }
    if (route === "review") {
      await requireIdentitySession(request, true);
      const params = new URL(request.url).searchParams;
      const status = z.enum(["pending", "all"]).parse(params.get("status") ?? "pending");
      const page = z.coerce.number().int().min(1).max(10_000).parse(params.get("page") ?? "1");
      return listAccountRequests(status, page);
    }
    if (route === "authority") {
      const { employee } = await requireIdentitySession(request);
      return mongoDemoAuthority.read(employee);
    }
    if (["profiles", "my-application", "audit"].includes(route) || route.startsWith("applications/") || route === "google/start")
      throw new SupportError("IDENTITY_ENDPOINT_RETIRED", "Chức năng này đã được thay bằng đăng nhập ID và mật khẩu.", 410);
    throw new SupportError("NOT_FOUND", "Không tìm thấy chức năng.", 404);
  });
}

export async function POST(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    requireSameOrigin(request);
    if (route === "login") {
      const result = await authenticatePasswordAccount(await supportBody(request), request);
      const response = successResponse({ status: result.status, redirectTo: result.redirectTo });
      response.headers.set("set-cookie", identitySessionCookie(result.token));
      response.headers.set("cache-control", "no-store");
      return response;
    }
    if (route === "logout") {
      await logoutIdentity(request);
      const response = successResponse({ signedOut: true });
      response.headers.set("set-cookie", identitySessionCookie("", true));
      response.headers.set("cache-control", "no-store");
      return response;
    }
    if (route === "applications") {
      const clientKey = identityClientRateLimitKey(request);
      await identityRateLimit(`account-request:client:${clientKey}`, 5, 60 * 60_000);
      const input = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254) }).strict().parse(await supportBody(request));
      await identityRateLimit(`account-request:email:${input.email.toLowerCase()}`, 2, 60 * 60_000);
      return successResponse(await submitAccountRequest(input), { status: 201 });
    }
    if (route === "review/decision") {
      const { principal } = await requireIdentitySession(request, true);
      const input = z.object({
        id: z.string().uuid(),
        decision: z.enum(["APPROVE", "REJECT"]),
      }).strict().parse(await supportBody(request));
      return successResponse(await decideAccountRequest(input.id, input.decision, principal.loginId));
    }
    if (route.startsWith("authority/")) {
      const { employee } = await requireIdentitySession(request);
      await identityRateLimit(`authority:${employee.id}`, 20);
      const body = await supportBody(request);
      const current = route === "authority/request" ? await requestDemoGrant(body, employee.id)
        : route === "authority/decision" ? await decideDemoGrant(body, employee.id)
        : route === "authority/usage" ? await updateDemoUsage(body, employee.id)
        : route === "authority/check" ? await checkDemoAuthority(body, employee)
        : null;
      if (!current) throw new SupportError("NOT_FOUND", "Không tìm thấy chức năng.", 404);
      return successResponse(current);
    }
    if (route === "access") {
      const { employee } = await requireIdentitySession(request);
      const { profileSchema, scopeSchema, evaluateScope } = await import("@/domain/identity");
      const scope = scopeSchema.parse(await supportBody(request));
      const { db } = await identityStore();
      const row = await db.collection("identity_profiles").findOne({ id: employee.profileId, version: employee.profileVersion, active: true });
      const result = evaluateScope(row ? profileSchema.parse(row).scopes : [], scope);
      return successResponse({ ...result, assurance: "password", executed: false });
    }
    if (["verify", "review"].includes(route) || route.startsWith("review/"))
      throw new SupportError("IDENTITY_APPROVAL_DISABLED", "Thao tác cấp tài khoản cần phiên Admin đã đăng nhập.", 403);
    if (route === "google/start")
      throw new SupportError("GOOGLE_SIGN_IN_DISABLED", "Đăng nhập Google đã được thay bằng ID và mật khẩu.", 410);
    throw new SupportError("NOT_FOUND", "Không tìm thấy chức năng.", 404);
  } catch (error) { return supportApi(async () => { throw error; }); }
}
