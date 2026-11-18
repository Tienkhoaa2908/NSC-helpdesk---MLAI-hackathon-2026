import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { compare } from "bcryptjs";
import { decideAccountRequest, listAccountRequests, submitAccountRequest } from "@/services/account-requests";

const fake = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  notices: [] as Array<Record<string, unknown>>,
  credentials: [] as Array<Record<string, unknown>>,
  rejections: [] as Array<Record<string, unknown>>,
  failNotice: false,
  failCredentials: false,
  duplicatePendingRequest: false,
}));

function getPath(row: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
}

function matches(row: Record<string, unknown>, query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") return (expected as Record<string, unknown>[]).some((branch) => matches(row, branch));
    const actual = getPath(row, key);
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const rules = expected as Record<string, unknown>;
      if ("$gt" in rules) return actual instanceof Date && actual > (rules.$gt as Date);
      if ("$lte" in rules) return actual instanceof Date && actual <= (rules.$lte as Date);
      if ("$exists" in rules) return (actual !== undefined) === rules.$exists;
    }
    return actual === expected;
  });
}

function apply(row: Record<string, unknown>, update: Record<string, Record<string, unknown>>) {
  Object.assign(row, structuredClone(update.$set ?? {}));
  for (const key of Object.keys(update.$unset ?? {})) delete row[key];
  for (const [key, delta] of Object.entries(update.$inc ?? {})) row[key] = Number(row[key] ?? 0) + Number(delta);
}

const db = {
  collection: (name: string) => {
    const rows = fake.rows[name] ??= [];
    return {
      findOne: async (query: Record<string, unknown>) => structuredClone(rows.find((row) => matches(row, query)) ?? null),
      insertOne: async (row: Record<string, unknown>) => {
        if (name === "identity_account_requests" && fake.duplicatePendingRequest) {
          fake.duplicatePendingRequest = false;
          throw Object.assign(new Error("E11000 duplicate pending request"), { code: 11000 });
        }
        rows.push(structuredClone(row));
        return { acknowledged: true };
      },
      updateOne: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>) => {
        const row = rows.find((candidate) => matches(candidate, query));
        if (row) apply(row, update);
        return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
      },
      find: (query: Record<string, unknown>) => {
        let offset = 0;
        let count = Number.MAX_SAFE_INTEGER;
        let sortBy: Record<string, 1 | -1> = {};
        const cursor = {
          sort(value: Record<string, 1 | -1>) { sortBy = value; return cursor; },
          skip(value: number) { offset = value; return cursor; },
          limit(value: number) { count = value; return cursor; },
          async toArray() {
            const values = rows.filter((row) => matches(row, query)).slice();
            values.sort((left, right) => {
              for (const [key, direction] of Object.entries(sortBy)) {
                const a = String(getPath(left, key) ?? "");
                const b = String(getPath(right, key) ?? "");
                if (a !== b) return a < b ? -direction : direction;
              }
              return 0;
            });
            return structuredClone(values.slice(offset, offset + count));
          },
        };
        return cursor;
      },
    };
  },
};

vi.mock("@/lib/identity-store", () => ({
  identityStore: async () => ({ db }),
  identityTransaction: async (work: (db: unknown, session: unknown) => Promise<unknown>) => work(db, {}),
}));

vi.mock("@/lib/identity-mailer", () => ({
  assertIdentityEmailConfigured: () => undefined,
  sendAccountRequestNotice: vi.fn(async (input: Record<string, unknown>) => {
    if (fake.failNotice) throw new Error("SMTP failure");
    fake.notices.push(structuredClone(input));
  }),
  sendIssuedCredentials: vi.fn(async (input: Record<string, unknown>) => {
    if (fake.failCredentials) throw new Error("SMTP failure");
    fake.credentials.push(structuredClone(input));
  }),
  sendAccountRequestRejected: vi.fn(async (input: Record<string, unknown>) => {
    if (fake.failCredentials) throw new Error("SMTP failure");
    fake.rejections.push(structuredClone(input));
  }),
}));

beforeEach(() => {
  fake.rows = {};
  fake.notices = [];
  fake.credentials = [];
  fake.rejections = [];
  fake.failNotice = false;
  fake.failCredentials = false;
  fake.duplicatePendingRequest = false;
});
afterEach(() => vi.restoreAllMocks());

it("stores a Gmail request and sends the Admin a non-mutating review link", async () => {
  const result = await submitAccountRequest({ fullName: "  Đào   Tiến Khoa ", email: "KHOA.DEMO@gmail.com" });
  const row = fake.rows.identity_account_requests[0];
  const notice = fake.notices[0];

  expect(result).toMatchObject({ status: "PENDING" });
  expect(row).toMatchObject({ id: result.id, fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com", status: "PENDING", notificationStatus: "SENT" });
  expect(row.approvalTokenHash).toBeNull();
  expect(notice).toMatchObject({ id: result.id, fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com" });
  expect(notice).not.toHaveProperty("approvalToken");
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "PENDING", email: "khoa.demo@gmail.com" }]);
  await expect(submitAccountRequest({ fullName: "Demo User", email: "person@example.com" })).rejects.toThrow("Chỉ chấp nhận địa chỉ Gmail.");
});

it("returns a conflict when concurrent submissions race on the pending-email index", async () => {
  fake.duplicatePendingRequest = true;

  await expect(submitAccountRequest({ fullName: "Demo User", email: "same@gmail.com" }))
    .rejects.toMatchObject({ code: "ACCOUNT_REQUEST_EXISTS", status: 409 });
  expect(fake.notices).toHaveLength(0);
  expect(fake.rows.identity_account_requests).toHaveLength(0);
});

it("keeps a request in Mongo and reports failed Admin notification delivery", async () => {
  fake.failNotice = true;

  const result = await submitAccountRequest({ fullName: "Demo User", email: "notify-failure@gmail.com" });

  expect(result).toMatchObject({ status: "PENDING", notificationStatus: "FAILED" });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    fullName: "Demo User",
    email: "notify-failure@gmail.com",
    status: "PENDING",
    notificationStatus: "FAILED",
  });
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "DELIVERY_FAILED" }]);
});

it("issues a random five-digit password after an explicit Admin approval", async () => {
  const submitted = await submitAccountRequest({ fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com" });
  const result = await decideAccountRequest(submitted.id, "APPROVE", "admin@gmail.com");
  const account = fake.rows.identity_password_accounts[0];
  const request = fake.rows.identity_account_requests[0];
  const email = fake.credentials[0];

  expect(result).toMatchObject({ status: "APPROVED", email: "khoa.demo@gmail.com" });
  expect(String(email.password)).toMatch(/^\d{5}$/);
  expect(account).toMatchObject({ loginId: "khoa.demo@gmail.com", email: "khoa.demo@gmail.com", role: "requester", kind: "employee", status: "ACTIVE" });
  expect(account.passwordHash).not.toBe(email.password);
  expect(await compare(String(email.password), String(account.passwordHash))).toBe(true);
  expect(request).toMatchObject({ status: "APPROVED", finalDecision: "APPROVED", notificationStatus: "SENT", approvalTokenHash: null });
  await expect(decideAccountRequest(submitted.id, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });
  await expect(submitAccountRequest({ fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com" })).rejects.toMatchObject({ code: "ACCOUNT_ALREADY_ACTIVE" });
  expect(await listAccountRequests("all", 1)).toMatchObject({ items: [{ status: "ISSUED" }] });
});

it("leaves a failed credential delivery inactive and allows an Admin to retry", async () => {
  const submitted = await submitAccountRequest({ fullName: "Demo User", email: "retry@gmail.com" });
  fake.failCredentials = true;

  await expect(decideAccountRequest(submitted.id, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_password_accounts[0]).toMatchObject({ status: "PENDING_DELIVERY" });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ status: "PENDING", finalDecision: "APPROVED", notificationStatus: "FAILED" });

  fake.failCredentials = false;
  await decideAccountRequest(submitted.id, "APPROVE", "admin@gmail.com");
  expect(fake.rows.identity_password_accounts[0].status).toBe("ACTIVE");
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ status: "APPROVED", finalDecision: "APPROVED", approvalTokenHash: null });
});

it("records a rejection, sends a fixed outcome email and allows retry if delivery fails", async () => {
  const submitted = await submitAccountRequest({ fullName: "Demo User", email: "reject@gmail.com" });
  fake.failCredentials = true;

  await expect(decideAccountRequest(submitted.id, "REJECT", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_OUTCOME_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "PENDING", finalDecision: "REJECTED", notificationStatus: "FAILED",
  });
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "REJECTION_DELIVERY_FAILED" }]);

  fake.failCredentials = true;
  await expect(decideAccountRequest(submitted.id, "REJECT", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_OUTCOME_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "PENDING", finalDecision: "REJECTED", notificationStatus: "FAILED",
  });
  fake.failCredentials = false;
  await decideAccountRequest(submitted.id, "REJECT", "admin@gmail.com");
  expect(fake.rejections).toMatchObject([{ email: "reject@gmail.com", fullName: "Demo User" }]);
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "APPROVED", finalDecision: "REJECTED", notificationStatus: "SENT",
  });
  expect(fake.rows.identity_password_accounts ?? []).toHaveLength(0);
  expect((await listAccountRequests("all", 1)).items).toMatchObject([{ status: "REJECTED" }]);
});
