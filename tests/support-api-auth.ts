import { vi } from "vitest";
import * as supportHttp from "@/lib/support-http";
import { employeeIdentityError } from "@/domain/employee-identity";
import { supportInputSchema } from "@/domain/input";
import { safeInput } from "@/domain/text";
import { validateVerificationInput } from "@/services/verification";
import { SupportError } from "@/lib/support-repository";

/**
 * API behavior tests exercise policy and persistence behind a synthetic,
 * authenticated fixture. Production authorization remains covered by the
 * identity authorization tests and the loopback-only Playwright adapter.
 */
export function mockSupportReviewAuthorization() {
  vi.spyOn(supportHttp, "requireDemoReviewer").mockImplementation(async (request) => {
    const mode = request.headers.get("x-test-auth-role");
    if (mode === "unauthenticated")
      throw new SupportError("AUTHENTICATION_REQUIRED", "Authentication required.", 401);
    if (mode === "requester")
      throw new SupportError("IT_AUTHORITY_REQUIRED", "Administrator access required.", 403);
    return "identity-admin:unit-test-admin";
  });

}

export function mockSupportApiAuthorization() {
  mockSupportReviewAuthorization();
  vi.spyOn(supportHttp, "requireEmployeeIdentity").mockImplementation(async (value, request) => {
    const mode = request?.headers.get("x-test-auth-role");
    if (mode === "unauthenticated")
      throw new SupportError("AUTHENTICATION_REQUIRED", "Authentication required.", 401);
    const input = supportInputSchema.parse(value);
    if (input.verifyRunId) {
      if (mode === "requester")
        throw new SupportError("IT_AUTHORITY_REQUIRED", "Administrator access required.", 403);
      await validateVerificationInput(safeInput(input).input);
      return input;
    }
    // The legacy fixtures model a signed-in demo requester. Preserve their
    // guest-shaped records only inside this test boundary.
    if (input.requesterMode === "guest") return input;
    const problem = employeeIdentityError(input.fields);
    if (problem) throw new SupportError("IDENTITY_REQUIRED", problem, 422);
    return input;
  });
}
