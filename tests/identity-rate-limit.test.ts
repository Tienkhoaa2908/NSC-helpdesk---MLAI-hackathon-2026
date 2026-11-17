import { beforeEach, describe, expect, it, vi } from "vitest";
import { identityClientRateLimitKey } from "@/lib/identity-auth";

const request = (headers: Record<string, string>) =>
  new Request("https://support.example/api/identity", { headers });

beforeEach(() => vi.unstubAllEnvs());

describe("Identity rate-limit client key", () => {
  it("uses Vercel's forwarded client IP and hashes it before storage", () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = identityClientRateLimitKey(request({
      "x-vercel-forwarded-for": "203.0.113.8",
      "x-forwarded-for": "198.51.100.4",
    }));
    const sameClient = identityClientRateLimitKey(request({
      "x-vercel-forwarded-for": "203.0.113.8",
      "x-forwarded-for": "192.0.2.44",
    }));
    const otherClient = identityClientRateLimitKey(request({ "x-vercel-forwarded-for": "203.0.113.9" }));

    expect(first).toBe(sameClient);
    expect(first).not.toBe(otherClient);
    expect(first).not.toContain("203.0.113.8");
  });

  it("does not trust caller-supplied forwarding headers in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const untrustedHeaders: Record<string, string>[] = [
      { "x-real-ip": "203.0.113.8" },
      { "x-forwarded-for": "203.0.113.9" },
    ];
    for (const headers of untrustedHeaders) {
      try { identityClientRateLimitKey(request(headers)); }
      catch (error) { expect(error).toMatchObject({ code: "CLIENT_IP_UNAVAILABLE" }); continue; }
      throw new Error("Expected a trusted Vercel client IP to be required");
    }
  });
});
