import { test, expect } from "./fixtures";
test("employee directory no longer trusts a caller-declared ID", async ({ anonymousRequest }) => {
  for (const headers of ([{}, { "X-Employee-ID": "alphanvgl" }] as Record<string, string>[])) {
    const response = await anonymousRequest.get("/api/employees", { headers });
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).not.toHaveProperty("data");
  }
});
