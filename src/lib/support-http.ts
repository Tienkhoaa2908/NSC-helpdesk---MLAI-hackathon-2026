import { z } from "zod";
import { errorResponse, successResponse } from "./api-response";
import { SupportError } from "./support-repository";
import { supportInputSchema } from "@/domain/input";
import { employeeIdentityError } from "@/domain/employee-identity";
import { safeInput } from "@/domain/text";
import { validateVerificationInput } from "@/services/verification";
import { identityPrincipalForRequest } from "./identity-auth";
import { isGuestDepartment } from "@/domain/guest-session";

type RateWindow = { startedAt: number; count: number };
type SupportHttpRuntime = { supportRateLimits?: Map<string, RateWindow> };
const httpRuntime = globalThis as typeof globalThis & SupportHttpRuntime;

export async function supportApi(work: () => Promise<unknown>, status = 200) {
  try {
    // This profile enables synthetic demo workflows; it does not grant reviewer access.
    // Fail closed until organization authentication is configured for non-demo operation.
    if (process.env.NODE_ENV === "production" && process.env.SUPPORT_ACCESS_MODE !== "public-demo")
      throw new SupportError("ORGANIZATION_AUTH_REQUIRED", "Cần cấu hình xác thực và phân quyền tổ chức trước khi vận hành với dữ liệu thật.", 403);
    return successResponse(await work(), { status });
  } catch (error) {
    if (error instanceof SupportError)
      return errorResponse(error.code, error.message, error.status);
    if (error instanceof z.ZodError)
      return errorResponse(
        "VALIDATION_ERROR",
        "Dữ liệu không hợp lệ.",
        422,
        error.issues.map((issue) => ({
          // Record keys can contain private input; expose only the schema root.
          field: String(issue.path[0] ?? "input"),
          code: issue.code,
        })),
      );
    // Never log database/provider exception bodies, prompts or credentials.
    return errorResponse(
      "SERVER_ERROR",
      "Không thể hoàn tất. Kiểm tra cấu hình hoặc thử lại sau.",
      503,
    );
  }
}
export async function supportBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    const parsed = URL.parse(origin),
      target = new URL(request.url);
    if (
      !parsed ||
      parsed.origin !== origin ||
      (origin !== target.origin &&
        !(
          parsed.host === request.headers.get("host") &&
          parsed.protocol === target.protocol
        ))
    )
      throw new SupportError("INVALID_ORIGIN", "Origin không hợp lệ.", 403);
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new SupportError("CONTENT_TYPE", "Cần JSON body.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new SupportError("VALIDATION_ERROR", "Thiếu body.", 422);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64000) {
        await reader.cancel();
        throw new SupportError("TOO_LARGE", "Nội dung quá dài.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new SupportError("VALIDATION_ERROR", "JSON không hợp lệ.", 422);
  }
}
export async function requireDemoReviewer(request: Request) {
  const principal = await identityPrincipalForRequest(request);
  if (principal.status === "ADMIN" && principal.canReviewIds)
    return `identity-admin:${principal.id}`;
  // Authenticated requester accounts can explore the public demo's support
  // workspace. Identity applications remain protected by the stricter
  // Admin-only guard in the identity API and page.
  if (principal.status === "ACTIVE" && process.env.SUPPORT_ACCESS_MODE === "public-demo")
    return `demo-reviewer:${principal.id}`;
  throw new SupportError("IT_AUTHORITY_REQUIRED", "Tài khoản này chưa có quyền xem khu vực xử lý hỗ trợ.", 403);
}
export async function requireEmployeeIdentity(value: unknown, request?: Request) {
  const input = supportInputSchema.parse(value);
  if (!request) throw new SupportError("AUTHENTICATION_REQUIRED", "Đăng nhập bằng ID nhân viên và mật khẩu để gửi yêu cầu hỗ trợ.", 401);
  const principal = await identityPrincipalForRequest(request);
  // Only an exact fixture in a server-created Verify run can use the synthetic path.
  // The employee UI cannot submit a reviewer fixture. Validate it against the
  // server-created run only after the caller has proved admin authority.
  if (input.verifyRunId) {
    if (principal.status !== "ADMIN" || !principal.canReviewIds)
      throw new SupportError("IT_AUTHORITY_REQUIRED", "Chỉ quản trị viên mới có thể chạy bộ kiểm thử Verify.", 403);
    await validateVerificationInput(safeInput(input).input);
    return input;
  }
  // The test-only loopback identity is an authenticated fixture. Preserve its
  // guest-shaped policy cases without granting that path to production clients.
  if (principal.isTestIdentity && input.requesterMode === "guest") return input;
  const employee = principal.employee;
  if (!employee)
    throw new SupportError("REQUESTER_ACCOUNT_REQUIRED", "Tài khoản này chỉ có quyền xử lý yêu cầu hỗ trợ.", 403);
  if (principal.demoRequester) {
    const department = input.guestDepartment ?? input.fields.department;
    if (!isGuestDepartment(department))
      throw new SupportError("IDENTITY_REQUIRED", "Chọn phòng ban trước khi gửi yêu cầu.", 422);
    input.requesterMode = "guest";
    input.guestDepartment = department;
    delete input.fields.employeeId;
    delete input.fields.department;
    return input;
  }
  if (input.requesterMode === "guest") {
    input.requesterMode = undefined;
    input.guestDepartment = undefined;
  }
  if (input.fields.employeeId && input.fields.employeeId.trim().toLowerCase() !== employee.id.toLowerCase())
    throw new SupportError("IDENTITY_MISMATCH", "ID trong yêu cầu khác phiên hiện tại. Tải lại hoặc đăng nhập lại.", 403);
  input.fields.employeeId = employee.id;
  const identityError = employeeIdentityError(input.fields);
  if (identityError)
    throw new SupportError(
      "IDENTITY_REQUIRED",
      identityError,
      422,
    );
  return input;
}
export function enforceDemoRateLimit(
  request: Request,
  scope: "intake" | "mutation" | "cache-verify" | "verify" | "ingress",
) {
  if (process.env.NODE_ENV !== "production") return;
  const now = Date.now();
  const windowMs = 60_000;
  // Isolated cache fixtures can restore 42 synthetic queue records after a run.
  // Allow the run plus restoration; ordinary intake/mutation limits stay unchanged.
  const limit = ["verify", "ingress"].includes(scope) ? 90 : scope === "cache-verify" ? 120 : scope === "intake" ? 30 : 15;
  const client =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";
  const key = `${scope}:${client.slice(0, 80)}`;
  const limits = (httpRuntime.supportRateLimits ??= new Map());
  const current = limits.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    if (limits.size >= 5000) {
      for (const [oldKey, oldWindow] of limits) if (now - oldWindow.startedAt >= windowMs) limits.delete(oldKey);
      if (limits.size >= 5000) limits.delete(limits.keys().next().value!);
    }
    limits.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= limit)
    throw new SupportError(
      "RATE_LIMITED",
      "Quá nhiều yêu cầu demo. Thử lại sau một phút.",
      429,
    );
  current.count += 1;
}
export const requestId = (id: string) => z.string().uuid().parse(id);
export function verifyModelOptions(request: Request) {
  const fault = request.headers.get("x-support-model-simulation");
  if (!fault) return {};
  if (
    process.env.SUPPORT_VERIFY_FAULTS !== "true" &&
    process.env.NODE_ENV === "production"
  )
    throw new SupportError(
      "SIMULATION_DISABLED",
      "Fault simulation chưa bật ở môi trường này.",
      403,
    );
  return { fault: z.enum(["unavailable", "invalid"]).parse(fault) };
}
