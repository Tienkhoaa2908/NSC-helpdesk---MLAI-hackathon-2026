import { afterEach, expect, it, vi } from "vitest";
import { requireDemoReviewer, requireEmployeeIdentity } from "@/lib/support-http";
import { identityPrincipalForRequest } from "@/lib/identity-auth";

afterEach(() => vi.unstubAllEnvs());

it("does not allow a guest-shaped request to bypass ID/password authentication", async () => {
  const body = {
    requesterMode: "guest",
    guestDepartment: "finance",
    rawText: "VPN không kết nối",
    idempotencyKey: crypto.randomUUID(),
  };
  const request = new Request("https://help.example/api/support/preview", { headers: {
    "x-support-e2e-identity": "a".repeat(64),
    "x-support-e2e-role": "admin",
  } });

  await expect(requireEmployeeIdentity(body, request)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
  await expect(requireEmployeeIdentity(body)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
});

it("requires admin authentication before Verify fixture validation", async () => {
  const request = new Request("https://help.example/api/support/requests", { headers: {
    "x-support-e2e-identity": "b".repeat(64),
    "x-support-e2e-role": "admin",
  } });
  const body = {
    rawText: "VPN không kết nối",
    idempotencyKey: crypto.randomUUID(),
    verifyRunId: crypto.randomUUID(),
    verifyCaseId: "case-1",
  };
  await expect(requireEmployeeIdentity(body, request)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
});

it("does not accept a forged loopback E2E header without an explicitly configured guard", async () => {
  vi.stubEnv("SUPPORT_E2E_PRODUCTION", "true");
  vi.stubEnv("SUPPORT_E2E_IDENTITY_SECRET", "");
  const request = new Request("http://127.0.0.1:3227/api/identity/session", { headers: {
    "x-support-e2e-identity": "c".repeat(64),
    "x-support-e2e-role": "admin",
  } });
  await expect(identityPrincipalForRequest(request)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
  await expect(requireDemoReviewer(request)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
});

it("accepts Next's localhost API URL only with the opt-in secret and fixed port", async () => {
  const secret = "d".repeat(64);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPPORT_E2E_PRODUCTION", "true");
  vi.stubEnv("SUPPORT_E2E_IDENTITY_SECRET", secret);

  const localRequest = new Request("http://localhost:3227/api/identity/session", { headers: {
    "x-support-e2e-identity": secret,
    "x-support-e2e-role": "admin",
  } });
  await expect(identityPrincipalForRequest(localRequest)).resolves.toMatchObject({ status: "ADMIN", isTestIdentity: true });

  const wrongPort = new Request("http://localhost:3228/api/identity/session", { headers: {
    "x-support-e2e-identity": secret,
    "x-support-e2e-role": "admin",
  } });
  await expect(identityPrincipalForRequest(wrongPort)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });

  const externalRequest = new Request("https://help.example/api/identity/session", { headers: {
    "x-support-e2e-identity": secret,
    "x-support-e2e-role": "admin",
  } });
  await expect(identityPrincipalForRequest(externalRequest)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED", status: 401 });
});
