import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { compare } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { authenticatePasswordAccount } from "@/services/password-auth";
import { identityCookie, identityPrincipalForRequest, requireIdentitySession } from "@/lib/identity-auth";
import { requireEmployeeIdentity } from "@/lib/support-http";
import { decryptTemporaryPassword } from "@/lib/identity-credentials";
import { sendAccountRequestNotice, sendAccountRequestRejected, sendIssuedCredentials } from "@/lib/identity-mailer";
import { decideAccountRequest, listAccountRequests, retryAccountRequestNotice, submitAccountRequest } from "@/services/account-requests";

const fake = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  notices: [] as Array<Record<string, unknown>>,
  credentials: [] as Array<Record<string, unknown>>,
  rejections: [] as Array<Record<string, unknown>>,
  failNotice: false,
  failCredentials: false,
  failNextIdentityTransaction: false,
  failCredentialFinalization: false,
  loseNextCommitReply: false,
  failNoticeFinalization: false,
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
    if (actual instanceof Date && expected instanceof Date) return actual.getTime() === expected.getTime();
    if (expected === null) return actual === undefined || actual === null;
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const rules = expected as Record<string, unknown>;
      if ("$in" in rules) return (rules.$in as unknown[]).includes(actual);
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
      findOneAndUpdate: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>, options?: { upsert?: boolean }) => {
        let row = rows.find((candidate) => matches(candidate, query));
        if (!row && options?.upsert) {
          row = { ...query, ...structuredClone(update.$setOnInsert ?? {}) };
          rows.push(row);
        }
        if (row) apply(row, update);
        return structuredClone(row ?? null);
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
  identityTransaction: async (work: (db: unknown, session: unknown) => Promise<unknown>) => {
    if (fake.failNextIdentityTransaction) {
      fake.failNextIdentityTransaction = false;
      throw new Error("simulated transaction failure");
    }
    const result = await work(db, {});
    if (fake.loseNextCommitReply) {
      fake.loseNextCommitReply = false;
      throw new Error("Commit acknowledgement lost");
    }
    return result;
  },
}));

vi.mock("@/lib/identity-mailer", () => ({
  assertIdentityEmailConfigured: () => undefined,
  sendAccountRequestNotice: vi.fn(async (input: Record<string, unknown>) => {
    if (fake.failNotice) throw new Error("SMTP failure");
    fake.notices.push(structuredClone(input));
    if (fake.failNoticeFinalization) {
      fake.failNoticeFinalization = false;
      fake.failNextIdentityTransaction = true;
    }
  }),
  sendIssuedCredentials: vi.fn(async (input: Record<string, unknown>) => {
    if (fake.failCredentials) throw new Error("SMTP failure");
    fake.credentials.push(structuredClone(input));
    if (fake.failCredentialFinalization) {
      fake.failCredentialFinalization = false;
      fake.failNextIdentityTransaction = true;
    }
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
  fake.failNextIdentityTransaction = false;
  fake.failCredentialFinalization = false;
  fake.loseNextCommitReply = false;
  fake.failNoticeFinalization = false;
  fake.duplicatePendingRequest = false;
  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 17).toString("base64"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("stores a Gmail request and sends the Admin a non-mutating review link", async () => {
  const result = await submitAccountRequest({ fullName: "  Đào   Tiến Khoa ", email: "KHOA.DEMO@gmail.com" });
  const row = fake.rows.identity_account_requests[0];
  const notice = fake.notices[0];

  expect(result).toEqual({ status: "RECEIVED" });
  expect(row).toMatchObject({ fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com", status: "PENDING", notificationStatus: "SENT" });
  expect(row.approvalTokenHash).toBeNull();
  expect(row.processingUntil).toBeUndefined();
  expect(notice).toMatchObject({ id: row.id, fullName: "Đào Tiến Khoa", email: "khoa.demo@gmail.com" });
  expect(notice).not.toHaveProperty("approvalToken");
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "PENDING", email: "khoa.demo@gmail.com" }]);
  await expect(submitAccountRequest({ fullName: "Demo User", email: "person@example.com" })).rejects.toThrow("Chỉ chấp nhận địa chỉ Gmail.");
});

it("returns the generic received response when concurrent submissions race on the pending-email index", async () => {
  fake.duplicatePendingRequest = true;

  await expect(submitAccountRequest({ fullName: "Demo User", email: "same@gmail.com" }))
    .resolves.toEqual({ status: "RECEIVED" });
  expect(fake.notices).toHaveLength(0);
  expect(fake.rows.identity_account_requests).toHaveLength(0);
});

it("saves the request before scheduling its notice and allows recovery if the scheduled work never starts", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const scheduled: Array<() => Promise<void>> = [];
  const input = { fullName: "Deferred Notice", email: "deferred.notice@gmail.com" };
  const enqueue = (work: () => Promise<void>) => { scheduled.push(work); };
  await expect(submitAccountRequest(input, enqueue)).resolves.toEqual({ status: "RECEIVED" });
  const request = fake.rows.identity_account_requests[0];
  expect(request.notificationStatus).toBe("PENDING");
  expect(fake.notices).toHaveLength(0);
  await submitAccountRequest(input, enqueue);
  expect(scheduled).toHaveLength(1);

  vi.setSystemTime(Date.now() + 121_000);
  await retryAccountRequestNotice(String(request.id), "admin@gmail.com");
  await scheduled[0]();
  expect(fake.notices).toHaveLength(1);
  expect(request.notificationStatus).toBe("SENT");
});

it("keeps a later notice result when the original SMTP callback finishes late", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const started = Promise.withResolvers<void>();
  const original = Promise.withResolvers<void>();
  vi.mocked(sendAccountRequestNotice).mockImplementationOnce(async () => {
    started.resolve();
    await original.promise;
  });
  const submit = submitAccountRequest({ fullName: "Late Notice", email: "late.notice@gmail.com" });
  await started.promise;
  const request = fake.rows.identity_account_requests[0];
  vi.setSystemTime(Date.now() + 121_000);
  await retryAccountRequestNotice(String(request.id), "admin@gmail.com");
  original.reject(new Error("Late SMTP timeout"));
  await submit;
  expect(request.notificationStatus).toBe("SENT");
  expect(fake.rows.identity_audit.map((audit) => audit.action)).not.toContain("ACCOUNT_REQUEST_NOTICE_UNCONFIRMED");
});

it("keeps a request in Mongo and reports failed Admin notification delivery", async () => {
  fake.failNotice = true;

  const result = await submitAccountRequest({ fullName: "Demo User", email: "notify-failure@gmail.com" });

  expect(result).toEqual({ status: "RECEIVED" });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    fullName: "Demo User",
    email: "notify-failure@gmail.com",
    status: "PENDING",
    notificationStatus: "FAILED",
  });
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "ADMIN_NOTICE_FAILED", retryAction: "ADMIN_NOTICE" }]);

  const requestId = fake.rows.identity_account_requests[0].id as string;
  const savedName = fake.rows.identity_account_requests[0].fullName;
  await expect(submitAccountRequest({ fullName: "Changed Name", email: "notify-failure@gmail.com" }))
    .resolves.toEqual(result);
  expect(fake.rows.identity_account_requests[0].fullName).toBe(savedName);
  expect(fake.rows.identity_account_requests).toHaveLength(1);
  expect(fake.notices).toHaveLength(0);

  fake.failNotice = false;
  await retryAccountRequestNotice(requestId, "admin@gmail.com");
  expect(fake.rows.identity_account_requests).toHaveLength(1);
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ id: requestId, notificationStatus: "SENT", finalDecision: null });
  expect(fake.notices).toMatchObject([{ id: requestId, email: "notify-failure@gmail.com" }]);
  expect(fake.rows.identity_audit.map((row) => row.action)).toContain("ACCOUNT_REQUEST_NOTICE_RETRY_STARTED");
});

it("keeps one request when SMTP accepts the Admin notice but recording the result fails", async () => {
  fake.failNoticeFinalization = true;

  const result = await submitAccountRequest({ fullName: "Notice Transaction", email: "notice.transaction@gmail.com" });
  const row = fake.rows.identity_account_requests[0];

  expect(result).toEqual({ status: "RECEIVED" });
  expect(fake.notices).toHaveLength(1);
  expect(row).toMatchObject({ status: "PENDING", notificationStatus: "PENDING" });
  expect(row.processingUntil).toBeInstanceOf(Date);
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "PROCESSING" }]);

  row.processingUntil = new Date(Date.now() - 1);
  await retryAccountRequestNotice(String(row.id), "admin@gmail.com");
  expect(fake.rows.identity_account_requests).toHaveLength(1);
  expect(fake.notices).toHaveLength(2);
  expect(fake.notices.map((notice) => notice.id)).toEqual([row.id, row.id]);
  expect(row).toMatchObject({ notificationStatus: "SENT" });
});

it("rejects a Gmail address that could not be used as a support employee ID before saving a request", async () => {
  for (const localPart of ["_demo", "x".repeat(65)]) {
    await expect(submitAccountRequest({ fullName: "Synthetic Applicant", email: `${localPart}@gmail.com` }))
      .rejects.toThrow("Phần trước @gmail.com");
  }
  expect(fake.rows.identity_account_requests ?? []).toHaveLength(0);
  expect(fake.notices).toHaveLength(0);
});

it("accepts the exact email credential at login and authorizes the resulting requester session for support intake", async () => {
  const applicant = { fullName: "Synthetic Applicant", email: `demo+${randomUUID()}'s@gmail.com` };
  vi.stubEnv("IDENTITY_ADMIN_ID", applicant.email);
  vi.stubEnv("IDENTITY_ADMIN_PASSWORD", randomUUID());
  await submitAccountRequest({ ...applicant, email: `  ${applicant.email.toUpperCase()}  ` });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  const result = await decideAccountRequest(requestId, "APPROVE", "admin@gmail.com");
  const account = fake.rows.identity_password_accounts[0];
  const request = fake.rows.identity_account_requests[0];
  const email = fake.credentials[0];

  expect(result).toMatchObject({ status: "APPROVED", email: applicant.email });
  expect(String(email.password)).toMatch(/^\d{5}$/);
  expect(account).toMatchObject({ loginId: applicant.email, email: applicant.email, role: "requester", kind: "employee", status: "ACTIVE" });
  expect(account.passwordHash).not.toBe(email.password);
  expect(await compare(String(email.password), String(account.passwordHash))).toBe(true);
  expect(account.credentialEnvelope).toBeUndefined();
  const login = await authenticatePasswordAccount({ employeeId: email.email, password: email.password }, new Request("http://localhost/api/identity/login", { headers: { "x-real-ip": "127.0.0.1" } }));
  expect(login).toMatchObject({ status: "ACTIVE", redirectTo: "/send-help" });
  const intake = new Request("http://localhost/api/support/preview", { headers: { cookie: `${identityCookie}=${login.token}` } });
  const principal = await identityPrincipalForRequest(intake);
  expect(principal).toMatchObject({ status: "ACTIVE", loginId: applicant.email, assurance: "password", canReviewIds: false, demoRequester: false });
  const body = { idempotencyKey: randomUUID(), rawText: "Synthetic VPN request", fields: { department: "engineering" } };
  await expect(requireEmployeeIdentity(body, intake)).resolves.toMatchObject({ fields: { department: "engineering", employeeId: applicant.email } });
  await expect(requireIdentitySession(intake, true)).rejects.toMatchObject({ status: 403 });
  expect(fake.rows.identity_password_accounts).toHaveLength(1);
  expect(request).toMatchObject({ status: "APPROVED", finalDecision: "APPROVED", notificationStatus: "SENT", approvalTokenHash: null });
  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });
  await expect(submitAccountRequest(applicant)).resolves.toEqual({ status: "RECEIVED" });
  expect(fake.rows.identity_account_requests).toHaveLength(1);
  expect(fake.notices).toHaveLength(1);
  expect((await listAccountRequests("all", 1)).items).toMatchObject([{ status: "ISSUED" }]);
});

it("claims one approval when two Admin requests arrive concurrently", async () => {
  await submitAccountRequest({ fullName: "Concurrent Approval", email: "concurrent.approval@gmail.com" });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  const results = await Promise.allSettled([
    decideAccountRequest(requestId, "APPROVE", "admin@gmail.com"),
    decideAccountRequest(requestId, "APPROVE", "admin@gmail.com"),
  ]);

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect(fake.rows.identity_password_accounts).toHaveLength(1);
  expect(fake.rows.identity_password_accounts[0].status).toBe("ACTIVE");
  expect(fake.credentials).toHaveLength(1);
});

it("commits only one outcome when different Admins submit opposite decisions together", async () => {
  await submitAccountRequest({ fullName: "Conflicting Decisions", email: "conflicting.decisions@gmail.com" });
  const request = fake.rows.identity_account_requests[0];
  const results = await Promise.allSettled([
    decideAccountRequest(String(request.id), "APPROVE", "first-admin"),
    decideAccountRequest(String(request.id), "REJECT", "second-admin"),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
  const issued = request.finalDecision === "APPROVED";
  expect(fake.credentials).toHaveLength(issued ? 1 : 0);
  expect(fake.rejections).toHaveLength(issued ? 0 : 1);
  expect(fake.rows.identity_password_accounts).toHaveLength(issued ? 1 : 0);
  expect(fake.rows.identity_audit.at(-1)).toMatchObject({
    actor: issued ? "first-admin" : "second-admin",
    action: issued ? "ACCOUNT_APPROVED" : "ACCOUNT_REJECTED",
    subject: request.id,
  });
});

it("reconciles a committed activation after the client loses the database acknowledgement", async () => {
  await submitAccountRequest({ fullName: "Acknowledgement Lost", email: "commit.lost@gmail.com" });
  const request = fake.rows.identity_account_requests[0];
  vi.mocked(sendIssuedCredentials).mockImplementationOnce(async (input) => {
    fake.credentials.push(structuredClone(input));
    fake.loseNextCommitReply = true;
  });
  await expect(decideAccountRequest(String(request.id), "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED" });
  expect((await listAccountRequests("all", 1)).items[0]).toMatchObject({ status: "ISSUED", retryAction: null });
  expect(fake.rows.identity_password_accounts[0]).toMatchObject({ status: "ACTIVE" });
  expect(fake.rows.identity_password_accounts[0]).not.toHaveProperty("credentialEnvelope");
  await expect(decideAccountRequest(String(request.id), "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });
  expect(fake.credentials).toHaveLength(1);
});

it("does not lock an approval decision when the encryption key is missing", async () => {
  await submitAccountRequest({ fullName: "Missing Key", email: "missing.key@gmail.com" });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", "");

  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "IDENTITY_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED", status: 503 });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ finalDecision: null, status: "PENDING" });
  expect(fake.rows.identity_password_accounts ?? []).toHaveLength(0);
  expect(fake.credentials).toHaveLength(0);
});

it("leaves a failed credential delivery inactive and allows an Admin to retry", async () => {
  await submitAccountRequest({ fullName: "Demo User", email: "retry@gmail.com" });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  fake.failCredentials = true;

  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_password_accounts[0]).toMatchObject({ status: "PENDING_DELIVERY" });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ status: "PENDING", finalDecision: "APPROVED", notificationStatus: "FAILED" });
  expect(fake.rows.identity_password_accounts[0].credentialEnvelope).toBeTruthy();
  const retryPassword = decryptTemporaryPassword(fake.rows.identity_password_accounts[0].credentialEnvelope as {
    version: 1; iv: string; ciphertext: string; authTag: string;
  });
  await expect(decideAccountRequest(requestId, "REJECT", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });
  expect(fake.rejections).toHaveLength(0);
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "DELIVERY_FAILED", email: "retry@gmail.com" }]);
  expect((await listAccountRequests("all", 1)).items).toMatchObject([{ status: "DELIVERY_FAILED", email: "retry@gmail.com" }]);

  fake.failCredentials = false;
  await decideAccountRequest(requestId, "APPROVE", "admin@gmail.com");
  expect(fake.credentials).toHaveLength(1);
  expect(fake.credentials[0].password).toBe(retryPassword);
  expect(fake.rows.identity_password_accounts[0].status).toBe("ACTIVE");
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ status: "APPROVED", finalDecision: "APPROVED", approvalTokenHash: null });
  expect((await listAccountRequests("all", 1)).items).toMatchObject([{ status: "ISSUED", email: "retry@gmail.com" }]);
});

it("reuses the exact same credential if SMTP accepted it but the activation transaction failed", async () => {
  await submitAccountRequest({ fullName: "Transaction Recovery", email: "transaction.retry@gmail.com" });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  fake.failCredentialFinalization = true;

  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED", status: 503 });
  const pending = fake.rows.identity_password_accounts[0];
  expect(pending).toMatchObject({ status: "PENDING_DELIVERY" });
  expect(pending.credentialEnvelope).toBeTruthy();
  expect(fake.rows.identity_account_requests[0]).toMatchObject({ status: "PENDING", notificationStatus: "PENDING", finalDecision: "APPROVED" });
  expect(fake.credentials).toHaveLength(1);

  fake.rows.identity_account_requests[0].processingUntil = new Date(Date.now() - 1);
  await decideAccountRequest(requestId, "APPROVE", "admin@gmail.com");

  expect(fake.credentials).toHaveLength(2);
  expect(fake.credentials[1].password).toBe(fake.credentials[0].password);
  expect(fake.rows.identity_password_accounts).toHaveLength(1);
  expect(fake.rows.identity_password_accounts[0].status).toBe("ACTIVE");
  expect(fake.rows.identity_password_accounts[0]).not.toHaveProperty("credentialEnvelope");
});

it("preserves a pending credential after a key change and can use the original SMTP-accepted password after restoring the key", async () => {
  const originalKey = process.env.IDENTITY_CREDENTIAL_ENCRYPTION_KEY!;
  await submitAccountRequest({ fullName: "Recovery Test", email: "restore.key@gmail.com" });
  const request = fake.rows.identity_account_requests[0];
  fake.failCredentialFinalization = true;
  await expect(decideAccountRequest(String(request.id), "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_UNCONFIRMED" });
  const pending = fake.rows.identity_password_accounts[0];
  const originalEnvelope = structuredClone(pending.credentialEnvelope);
  const originalHash = pending.passwordHash;
  request.processingUntil = new Date(Date.now() - 1);
  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 31).toString("base64"));

  await expect(decideAccountRequest(String(request.id), "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED", status: 503 });
  expect(pending).toMatchObject({ passwordHash: originalHash, credentialEnvelope: originalEnvelope, status: "PENDING_DELIVERY" });
  expect(fake.credentials).toHaveLength(1);
  expect(request).toMatchObject({ notificationStatus: "FAILED", finalDecision: "APPROVED" });
  expect(fake.rows.identity_audit.at(-1)).toMatchObject({ action: "ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED", actor: "admin@gmail.com", subject: request.id });

  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", originalKey);
  await decideAccountRequest(String(request.id), "APPROVE", "admin@gmail.com");
  expect(fake.credentials).toHaveLength(2);
  expect(fake.credentials[1].password).toBe(fake.credentials[0].password);
  expect(pending).toMatchObject({ status: "ACTIVE", passwordHash: originalHash });
  expect(pending).not.toHaveProperty("credentialEnvelope");
});

it.each(["null", "missing"] as const)("preserves the hash if a modern account has a %s retry envelope", async (invalidEnvelope) => {
  await submitAccountRequest({ fullName: "Malformed Copy", email: "malformed.copy@gmail.com" });
  const requestId = String(fake.rows.identity_account_requests[0].id);
  fake.failCredentials = true;
  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_EMAIL_FAILED" });
  const account = fake.rows.identity_password_accounts[0];
  const hash = account.passwordHash;
  if (invalidEnvelope === "null") account.credentialEnvelope = null;
  else delete account.credentialEnvelope;
  fake.failCredentials = false;
  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com")).rejects.toMatchObject({ code: "ACCOUNT_CREDENTIAL_RECOVERY_REQUIRED" });
  expect(account).toMatchObject({ status: "PENDING_DELIVERY", passwordHash: hash });
  expect(account.credentialEnvelope).toBe(invalidEnvelope === "null" ? null : undefined);
  expect(fake.credentials).toHaveLength(0);
});

it.each(["APPROVE", "REJECT"] as const)("only the current %s attempt can release its lease or finalize its result", async (decision) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await submitAccountRequest({ fullName: "Delayed Send", email: "slow.send@gmail.com" });
  const request = fake.rows.identity_account_requests[0];
  const original = Promise.withResolvers<void>();
  const retry = Promise.withResolvers<void>();
  const firstStarted = Promise.withResolvers<void>();
  const retryStarted = Promise.withResolvers<void>();
  const mailer = decision === "APPROVE" ? vi.mocked(sendIssuedCredentials) : vi.mocked(sendAccountRequestRejected);
  mailer.mockImplementationOnce(async () => { firstStarted.resolve(); await original.promise; });
  mailer.mockImplementationOnce(async () => { retryStarted.resolve(); await retry.promise; });
  const firstResult = decideAccountRequest(String(request.id), decision, "first-admin").catch((error: unknown) => error);
  await firstStarted.promise;
  vi.setSystemTime(Date.now() + 121_000);
  await expect(decideAccountRequest(String(request.id), decision === "APPROVE" ? "REJECT" : "APPROVE", "second-admin"))
    .rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });
  const secondResult = decideAccountRequest(String(request.id), decision, "second-admin");
  await retryStarted.promise;
  if (decision === "APPROVE") original.resolve();
  else original.reject(new Error("Late SMTP failure"));
  expect(await firstResult).toBeInstanceOf(Error);
  expect((await listAccountRequests("pending", 1)).items[0].status).toBe("PROCESSING");
  if (decision === "APPROVE") expect(fake.rows.identity_password_accounts[0].status).toBe("PENDING_DELIVERY");

  retry.resolve();
  await secondResult;
  expect(request.notificationStatus).toBe("SENT");
  expect(request.processingUntil).toBeUndefined();
  expect(fake.rows.identity_audit.at(-1)).toMatchObject({ actor: "second-admin", subject: request.id });
});

it("shows active approval and rejection email sends as processing, then recovers expired leases", async () => {
  const approvalId = "00000000-0000-4000-8000-000000000001";
  const rejectionId = "00000000-0000-4000-8000-000000000002";
  const approvedRetryId = "00000000-0000-4000-8000-000000000003";
  const rejectedRetryId = "00000000-0000-4000-8000-000000000004";
  const createdAt = new Date().toISOString();
  const futureLease = new Date(Date.now() + 60_000);
  const rows = fake.rows.identity_account_requests = [
    {
      id: approvalId, fullName: "Approval In Progress", email: "approval.inflight@gmail.com",
      status: "PENDING", finalDecision: "APPROVED", notificationStatus: "PENDING",
      processingUntil: futureLease, createdAt, updatedAt: createdAt,
    },
    {
      id: rejectionId, fullName: "Rejection In Progress", email: "rejection.inflight@gmail.com",
      status: "PENDING", finalDecision: "REJECTED", notificationStatus: "PENDING",
      processingUntil: futureLease, createdAt, updatedAt: createdAt,
    },
    {
      id: approvedRetryId, fullName: "Approved Retry In Progress", email: "approved.retry@gmail.com",
      status: "APPROVED", finalDecision: "APPROVED", notificationStatus: "PENDING",
      processingUntil: futureLease, createdAt, updatedAt: createdAt,
    },
    {
      id: rejectedRetryId, fullName: "Rejected Retry In Progress", email: "rejected.retry@gmail.com",
      status: "APPROVED", finalDecision: "REJECTED", notificationStatus: "PENDING",
      processingUntil: futureLease, createdAt, updatedAt: createdAt,
    },
  ];
  fake.rows.identity_password_accounts = [{
    id: "existing-approved-retry-account", loginId: "approved.retry@gmail.com", email: "approved.retry@gmail.com",
    fullName: "Approved Retry In Progress", passwordHash: "previous-hash", role: "requester", kind: "employee",
    status: "PENDING_DELIVERY", applicationId: approvedRetryId, createdAt, updatedAt: createdAt,
  }];

  expect((await listAccountRequests("pending", 1)).items.map((item) => item.status))
    .toEqual(["PROCESSING", "PROCESSING", "PROCESSING", "PROCESSING"]);
  expect((await listAccountRequests("all", 1)).items.map((item) => item.status))
    .toEqual(["PROCESSING", "PROCESSING", "PROCESSING", "PROCESSING"]);

  for (const row of rows) row.processingUntil = new Date(Date.now() - 1);
  expect((await listAccountRequests("pending", 1)).items.map((item) => item.status))
    .toEqual(["DELIVERY_FAILED", "REJECTION_DELIVERY_FAILED", "DELIVERY_FAILED", "REJECTION_DELIVERY_FAILED"]);

  await decideAccountRequest(approvalId, "APPROVE", "admin@gmail.com");
  await decideAccountRequest(rejectionId, "REJECT", "admin@gmail.com");
  await decideAccountRequest(approvedRetryId, "APPROVE", "admin@gmail.com");
  expect(fake.rows.identity_audit.filter((entry) => entry.action === "ACCOUNT_CREDENTIAL_REPLACED"))
    .toMatchObject([{ subject: approvedRetryId }]);
  await decideAccountRequest(rejectedRetryId, "REJECT", "admin@gmail.com");
  expect((await listAccountRequests("all", 1)).items.map((item) => item.status))
    .toEqual(["ISSUED", "REJECTED", "ISSUED", "REJECTED"]);
});

it("records a rejection, sends a fixed outcome email and allows retry if delivery fails", async () => {
  await submitAccountRequest({ fullName: "Demo User", email: "reject@gmail.com" });
  const requestId = fake.rows.identity_account_requests[0].id as string;
  fake.failCredentials = true;

  await expect(decideAccountRequest(requestId, "REJECT", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_OUTCOME_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "PENDING", finalDecision: "REJECTED", notificationStatus: "FAILED",
  });
  expect((await listAccountRequests("pending", 1)).items).toMatchObject([{ status: "REJECTION_DELIVERY_FAILED" }]);
  await expect(decideAccountRequest(requestId, "APPROVE", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_REQUEST_ALREADY_DECIDED" });

  fake.failCredentials = true;
  await expect(decideAccountRequest(requestId, "REJECT", "admin@gmail.com"))
    .rejects.toMatchObject({ code: "ACCOUNT_OUTCOME_EMAIL_FAILED", status: 503 });
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "PENDING", finalDecision: "REJECTED", notificationStatus: "FAILED",
  });
  fake.failCredentials = false;
  await decideAccountRequest(requestId, "REJECT", "admin@gmail.com");
  expect(fake.rejections).toMatchObject([{ email: "reject@gmail.com", fullName: "Demo User" }]);
  expect(fake.rows.identity_account_requests[0]).toMatchObject({
    status: "APPROVED", finalDecision: "REJECTED", notificationStatus: "SENT",
  });
  expect(fake.rows.identity_password_accounts ?? []).toHaveLength(0);
  expect((await listAccountRequests("all", 1)).items).toMatchObject([{ status: "REJECTED" }]);
  await expect(authenticatePasswordAccount({ employeeId: fake.rejections[0].email, password: randomUUID() },
    new Request("http://localhost/api/identity/login", { headers: { "x-real-ip": "127.0.0.1" } })))
    .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  expect(fake.rows.identity_sessions ?? []).toHaveLength(0);
});
