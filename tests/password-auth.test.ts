import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { compare } from "bcryptjs";
import { authenticatePasswordAccount, allowlistedAdminNext } from "@/services/password-auth";
import { identityPrincipalForRequest, identitySessionCookie } from "@/lib/identity-auth";

const fake = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]> }));

function matches(row: Record<string, unknown>, query: Record<string, unknown>) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const rules = expected as Record<string, unknown>;
      if ("$gt" in rules) return actual instanceof Date && actual > (rules.$gt as Date);
    }
    return actual === expected;
  });
}

function apply(row: Record<string, unknown>, update: Record<string, Record<string, unknown>>) {
  Object.assign(row, structuredClone(update.$set ?? {}));
  for (const [key, delta] of Object.entries(update.$inc ?? {})) row[key] = Number(row[key] ?? 0) + Number(delta);
}

const db = {
  collection: (name: string) => {
    const rows = fake.rows[name] ??= [];
    return {
      findOne: async (query: Record<string, unknown>) => structuredClone(rows.find((row) => matches(row, query)) ?? null),
      insertOne: async (row: Record<string, unknown>) => { rows.push(structuredClone(row)); return { acknowledged: true }; },
      updateOne: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>, options?: { upsert?: boolean }) => {
        let row = rows.find((candidate) => matches(candidate, query));
        if (!row && options?.upsert) {
          row = { ...query, ...structuredClone(update.$setOnInsert ?? {}) };
          rows.push(row);
        }
        if (row) apply(row, update);
        return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0, upsertedCount: row && !options?.upsert ? 0 : 1 };
      },
      findOneAndUpdate: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>, options?: { upsert?: boolean }) => {
        let row = rows.find((candidate) => matches(candidate, query));
        if (!row && options?.upsert) {
          row = { ...query, ...structuredClone(update.$setOnInsert ?? {}) };
          rows.push(row);
        }
        if (row) apply(row, update);
        return structuredClone(row ?? null);
      },
      deleteOne: async (query: Record<string, unknown>) => {
        const index = rows.findIndex((candidate) => matches(candidate, query));
        if (index < 0) return { deletedCount: 0 };
        rows.splice(index, 1);
        return { deletedCount: 1 };
      },
    };
  },
};

vi.mock("@/lib/identity-store", () => ({
  identityStore: async () => ({ db }),
  identityTransaction: async (work: (db: unknown, session: unknown) => Promise<unknown>) => work(db, {}),
}));

const loginRequest = () => new Request("http://localhost/api/identity/login", { headers: { "x-real-ip": "127.0.0.1" } });
const cookieRequest = (token: string) => new Request("http://localhost/api/identity/session", { headers: { cookie: identitySessionCookie(token) } });

beforeEach(() => {
  fake.rows = {};
  vi.unstubAllEnvs();
});
afterEach(() => vi.restoreAllMocks());

it("seeds the public requester as a hash-only Mongo account and reuses it on later logins", async () => {
  const first = await authenticatePasswordAccount({ employeeId: " GUEST01 ", password: "12345" }, loginRequest());
  const account = fake.rows.identity_password_accounts[0];
  const principal = await identityPrincipalForRequest(cookieRequest(first.token));

  expect(first).toMatchObject({ status: "ACTIVE", redirectTo: "/send-help" });
  expect(account).toMatchObject({ loginId: "guest01", kind: "demo", role: "requester", status: "ACTIVE" });
  expect(account.passwordHash).not.toBe("12345");
  expect(await compare("12345", String(account.passwordHash))).toBe(true);
  expect(principal).toMatchObject({ status: "ACTIVE", id: "guest01", demoRequester: true, canReviewIds: false });
  expect(principal).not.toHaveProperty("canReviewIds", true);

  await authenticatePasswordAccount({ employeeId: "guest01", password: "12345" }, loginRequest());
  expect(fake.rows.identity_password_accounts).toHaveLength(1);
});

it("grants reviewer access only to configured server-side admin credentials and keeps redirects local", async () => {
  vi.stubEnv("IDENTITY_ADMIN_ID", "root-admin");
  vi.stubEnv("IDENTITY_ADMIN_PASSWORD", "A-Long-Demo-Only-Admin-Password");
  vi.stubEnv("IDENTITY_ADMIN_EMAIL", "owner@gmail.com");
  const result = await authenticatePasswordAccount({ employeeId: "ROOT-ADMIN", password: "A-Long-Demo-Only-Admin-Password", next: "/verify" }, loginRequest());
  const principal = await identityPrincipalForRequest(cookieRequest(result.token));

  expect(result).toMatchObject({ status: "ADMIN", redirectTo: "/verify" });
  expect(principal).toMatchObject({ status: "ADMIN", id: "root-admin", canReviewIds: true, assurance: "password" });
  expect(principal.employee).toBeUndefined();
  expect(allowlistedAdminNext("//attacker.example/steal")).toBe("/review");
  expect(allowlistedAdminNext("/verify?redirect=https://attacker.example")).toBe("/review");
  expect(allowlistedAdminNext("/identity/review")).toBe("/identity/review");
});

it("rejects unknown credentials with a generic authentication error", async () => {
  await expect(authenticatePasswordAccount({ employeeId: "unknown@gmail.com", password: "wrong" }, loginRequest()))
    .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
});

it("issues an opaque HttpOnly cookie and marks it Secure in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  const cookie = identitySessionCookie("a".repeat(64));
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Secure");
  expect(cookie).not.toContain("Max-Age");
  expect(identitySessionCookie("", true)).toContain("Max-Age=0");
});
