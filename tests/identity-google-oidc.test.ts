import { beforeEach, describe, expect, it, vi } from "vitest";
import { googleFlowCookie, googleFlowCookieName, googleFlowId, googleOidcConfiguration, safeIdentityReturnTo, verifiedGoogleClaims } from "@/lib/google-oidc";

const now = 1_800_000_000;
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com", aud: "client-id", sub: "stable-google-sub",
  email: "Person@Gmail.com", email_verified: true, name: "Person Example",
  iat: now - 30, exp: now + 300, ...overrides,
});
function expectInvalidGoogleClaims(value: Record<string, unknown>) {
  try { verifiedGoogleClaims(claims(value), "client-id", now); }
  catch (error) { expect(error).toMatchObject({ code: "GOOGLE_IDENTITY_INVALID" }); return; }
  throw new Error("Expected invalid Google claims to be rejected");
}
beforeEach(() => { vi.unstubAllEnvs(); });

describe("Google OIDC claim validation", () => {
  it("fails with an explicit configuration error when OAuth credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "");
    await expect(googleOidcConfiguration()).rejects.toMatchObject({ code: "GOOGLE_OAUTH_NOT_CONFIGURED" });
  });
  it("accepts a verified gmail.com address and canonicalizes it", () => {
    expect(verifiedGoogleClaims(claims(), "client-id", now)).toEqual({
      sub: "stable-google-sub", email: "person@gmail.com", name: "Person Example",
    });
  });
  it("rejects verified accounts outside the configured Gmail domain", () => {
    expectInvalidGoogleClaims({ email: "person@example.com" });
  });
  it("requires the signed hosted-domain claim when configured for Google Workspace", () => {
    vi.stubEnv("GOOGLE_ALLOWED_DOMAIN", "example.com");
    expectInvalidGoogleClaims({ email: "person@example.com" });
    expect(verifiedGoogleClaims(claims({ email: "person@example.com", hd: "example.com" }), "client-id", now).email)
      .toBe("person@example.com");
  });
  it.each([
    ["wrong issuer", { iss: "https://attacker.example" }],
    ["wrong audience", { aud: "different-client" }],
    ["unverified email", { email_verified: false }],
    ["expired ID token", { exp: now }],
    ["future issued-at", { iat: now + 61 }],
    ["future not-before", { nbf: now + 31 }],
    ["wrong authorized party", { azp: "different-client" }],
    ["missing subject", { sub: "" }],
    ["invalid email", { email: "not-an-email" }],
  ])("rejects %s", (_caseName, override) => {
    try { verifiedGoogleClaims(claims(override), "client-id", now); }
    catch (error) { expect(error).toMatchObject({ code: "GOOGLE_IDENTITY_INVALID" }); return; }
    throw new Error("Expected invalid Google claims to be rejected");
  });
  it("accepts array audiences containing the configured client and matching azp", () => {
    expect(verifiedGoogleClaims(claims({ aud: ["other-client", "client-id"], azp: "client-id" }), "client-id", now).sub)
      .toBe("stable-google-sub");
  });
});

describe("Google login browser binding", () => {
  it("allows only supported internal return paths", () => {
    expect(safeIdentityReturnTo("/identity/new")).toBe("/identity/new");
    expect(safeIdentityReturnTo("/identity/review")).toBe("/identity/review");
    for (const value of ["https://attacker.example", "//attacker.example", "javascript:alert(1)", "/api/admin"])
      expect(safeIdentityReturnTo(value)).toBe("/send-help");
  });
  it("uses a short-lived, HttpOnly, same-site, path-scoped cookie for the flow ID", () => {
    vi.stubEnv("NODE_ENV", "production");
    const cookie = googleFlowCookie("a".repeat(64));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/identity/google");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toContain("Secure");
    const request = new Request("https://app.example/api/identity/google/callback", { headers: { cookie: `${googleFlowCookieName()}=${"a".repeat(64)}` } });
    expect(googleFlowId(request)).toBe("a".repeat(64));
    expect(googleFlowId(new Request("https://app.example", { headers: { cookie: `${googleFlowCookieName()}=invalid` } }))).toBeNull();
  });
});
