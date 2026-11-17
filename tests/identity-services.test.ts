import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Scope } from "@/domain/identity";
import { decideIdentityApplication, submitIdentityApplication, trackIdentityApplication } from "@/services/identity";
import { createIdentitySession, identityPrincipalForRequest, requireIdentitySession } from "@/lib/identity-auth";
import { identityHash } from "@/services/identity";
import { requireEmployeeIdentity } from "@/lib/support-http";

// Test-only adapter models rollback and compare-and-set; it is never a runtime fallback.
const fake = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, unavailable: false, failAudit: false }));
vi.mock("@/lib/identity-store", () => {
  function valueAt(row: Record<string, unknown>, path: string) {
    return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
  }
  function match(row: Record<string, unknown>, query: Record<string, unknown>) {
    return Object.entries(query).every(([key, value]) => {
      const found = valueAt(row, key);
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const rule = value as Record<string, unknown>;
        if ("$in" in rule) return (rule.$in as unknown[]).includes(found);
        if ("$gt" in rule) return found instanceof Date && found > (rule.$gt as Date);
        if ("$lt" in rule) return typeof found === "number" && found < (rule.$lt as number);
      }
      return found === value;
    });
  }
  function patch(row: Record<string, unknown>, update: Record<string, Record<string, unknown>>) {
    Object.assign(row, update.$set);
    for (const [key, value] of Object.entries(update.$inc ?? {})) row[key] = Number(row[key] ?? 0) + Number(value);
  }
  const db = { collection: (name: string) => {
    const rows = fake.rows[name] ??= [];
    return {
      findOne: async (query: Record<string, unknown>) => structuredClone(rows.find((row) => match(row, query)) ?? null),
      insertOne: async (row: Record<string, unknown>) => { if (fake.failAudit && name === "identity_audit") throw new Error("AUDIT_UNAVAILABLE"); rows.push(structuredClone(row)); return { acknowledged: true }; },
      updateOne: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>) => { const row = rows.find((row) => match(row, query)); if (row) patch(row, update); return { modifiedCount: row ? 1 : 0 }; },
      findOneAndUpdate: async (query: Record<string, unknown>, update: Record<string, Record<string, unknown>>, options?: { upsert?: boolean }) => {
        let row = rows.find((row) => match(row, query));
        if (!row && options?.upsert) { row = { ...query, ...update.$setOnInsert }; rows.push(row); }
        if (row) patch(row, update); return structuredClone(row ?? null);
      },
      deleteOne: async (query: Record<string, unknown>) => { const index = rows.findIndex((row) => match(row, query)); if (index < 0) return { deletedCount: 0 }; rows.splice(index, 1); return { deletedCount: 1 }; },
    };
  } };
  const store = async () => { if (fake.unavailable) throw new Error("DB_UNAVAILABLE"); return { db }; };
  return { identityStore: store, identityTransaction: async (work: (db: unknown, session: unknown) => Promise<unknown>) => {
    await store(); const snapshot = structuredClone(fake.rows);
    try { return await work(db, {}); } catch (error) { fake.rows = snapshot; throw error; }
  } };
});

const scope: Scope = { environment: "sandbox", resource: "project", operation: "read", target: "project-demo" };
const applicant = { sub: "google-sub-employee-alpha", email: "alpha@gmail.com" };
const input = () => ({ id: randomUUID(), trackingToken: "a".repeat(64), fullName: "Nhân Viên Giả Lập Alpha", job: { kind: "new" as const, name: "Job giả lập", scopes: [scope] } });
const decision = { action: "approve", version: 0, reason: "Đã xác minh qua quy trình thử nghiệm", approvedScopes: [scope] };
const requestWithCookie = (token: string) => new Request("http://localhost", { headers: { cookie: `vng_identity=${token}` } });
beforeEach(() => { fake.rows = {}; fake.unavailable = false; fake.failAudit = false; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("binds every access application to server-verified Google sub and email", async () => {
  const request = input();
  await submitIdentityApplication(request, applicant);
  await submitIdentityApplication(request, applicant);
  expect(fake.rows.identity_applications).toHaveLength(1);
  expect(fake.rows.identity_applications[0].applicant).toEqual(applicant);
  expect(fake.rows.identity_applications[0]).not.toHaveProperty("trackingToken");
  expect(fake.rows.identity_employees).toHaveLength(0);
  await expect(submitIdentityApplication({ ...request, id: randomUUID(), trackingToken: "b".repeat(64) }, applicant)).rejects.toMatchObject({ code: "APPLICATION_EXISTS" });
  await expect(submitIdentityApplication({ ...request, applicant: { sub: "attacker", email: "attacker@gmail.com" } }, applicant)).rejects.toThrow();
});
it("requires the private tracking capability and does not expose applicant claims", async () => {
  const request = input(); await submitIdentityApplication(request, applicant);
  await expect(trackIdentityApplication(request.id, "b".repeat(64))).rejects.toMatchObject({ status: 404 });
  const tracked = await trackIdentityApplication(request.id, request.trackingToken);
  expect(tracked).not.toHaveProperty("applicant");
  expect(tracked.employeeId).toBeUndefined();
});
it("creates an employee ID only after review and binds the account to the submitted Google sub", async () => {
  const request = input(); await submitIdentityApplication(request, applicant);
  const result = await decideIdentityApplication(request.id, decision, "reviewer@example.com");
  expect(result.employeeId).toBe("alphanvgl");
  expect(fake.rows.identity_employees[0]).toMatchObject({ googleSub: applicant.sub, email: applicant.email, status: "ACTIVE", roles: [] });
  expect(fake.rows.identity_profiles[0]).toMatchObject({ version: 1, scopes: [scope] });
  expect((await trackIdentityApplication(request.id, request.trackingToken)).grantedScopes).toEqual([scope]);
  expect(fake.rows.identity_audit.map((row) => row.action)).toEqual(["APPLICATION_SUBMITTED", "PROFILE_CREATED", "APPROVED"]);
  await expect(decideIdentityApplication(request.id, decision, "reviewer@example.com")).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
});
it("does not link a legacy/synthetic employee by matching name or employee ID", async () => {
  fake.rows.identity_employees = [{ id: "old-synthetic-id", fullName: "Nhân Viên Giả Lập Alpha", status: "ACTIVE", profileId: "legacy", profileVersion: 1, roles: ["identity-admin"], applicationId: "legacy", createdAt: "2026-01-01" }];
  const request = input(); await submitIdentityApplication(request, applicant);
  const token = await createIdentitySession({ ...applicant, name: "Nhân Viên Giả Lập Alpha" });
  const principal = await identityPrincipalForRequest(requestWithCookie(token));
  expect(principal.status).toBe("PENDING");
  expect(principal).not.toHaveProperty("employee");
  await expect(requireIdentitySession(requestWithCookie(token))).rejects.toMatchObject({ code: "ACTIVE_EMPLOYEE_REQUIRED" });
});
it("treats the session cookie as an opaque verified session and activates it after approval", async () => {
  const request = input(); await submitIdentityApplication(request, applicant);
  const token = await createIdentitySession({ ...applicant, name: "Google Alpha" });
  expect(fake.rows.identity_sessions[0]).toMatchObject({ hash: identityHash(token), googleSub: applicant.sub, email: applicant.email });
  expect(fake.rows.identity_sessions[0]).not.toHaveProperty("token");
  expect(fake.rows.identity_sessions[0]).not.toHaveProperty("accessToken");
  expect(fake.rows.identity_sessions[0]).not.toHaveProperty("refreshToken");
  expect((await identityPrincipalForRequest(requestWithCookie(token))).status).toBe("PENDING");
  await decideIdentityApplication(request.id, decision, "reviewer@example.com");
  const active = await identityPrincipalForRequest(requestWithCookie(token));
  expect(active).toMatchObject({ status: "ACTIVE", employee: { id: "alphanvgl", googleSub: applicant.sub }, assurance: "verified" });
  expect(active).not.toHaveProperty("id");
  await expect(requireIdentitySession(requestWithCookie(token))).resolves.toMatchObject({ employee: { id: "alphanvgl" }, assurance: "verified" });
});
it("requires the server allowlist for identity-admin operations and fails closed when it is empty", async () => {
  const admin = { sub: "google-sub-admin", email: "admin@gmail.com", name: "Admin" };
  const token = await createIdentitySession(admin); const request = requestWithCookie(token);
  await expect(requireIdentitySession(request, true)).rejects.toMatchObject({ code: "IT_AUTHORITY_REQUIRED" });
  vi.stubEnv("IDENTITY_ADMIN_EMAILS", "other@gmail.com, ADMIN@gmail.com");
  await expect(requireIdentitySession(request, true)).resolves.toMatchObject({ principal: { status: "ADMIN", email: "admin@gmail.com", canReviewIds: true } });
  await expect(requireIdentitySession(request)).rejects.toMatchObject({ code: "ACTIVE_EMPLOYEE_REQUIRED" });
});
it("pins existing job permissions and refuses modifications", async () => {
  const profile = { id: randomUUID(), version: 2, active: true, scopes: [scope], name: "Profile giả lập", createdAt: new Date().toISOString(), createdBy: "operator" };
  fake.rows.identity_profiles = [profile]; const request = { ...input(), job: { kind: "existing" as const, profileId: profile.id, version: 2 } };
  await submitIdentityApplication(request, applicant);
  await expect(decideIdentityApplication(request.id, decision, "reviewer@example.com")).rejects.toMatchObject({ code: "PROFILE_IMMUTABLE" });
  await decideIdentityApplication(request.id, { action: "approve", version: 0, reason: decision.reason }, "reviewer@example.com");
  expect(fake.rows.identity_profiles).toHaveLength(1); expect(fake.rows.identity_employees[0].profileVersion).toBe(2);
});
it("does not grant scopes outside the submitted request", async () => {
  const request = input(); await submitIdentityApplication(request, applicant);
  await expect(decideIdentityApplication(request.id, { ...decision, approvedScopes: [{ ...scope, target: "another-project" }] }, "reviewer@example.com")).rejects.toMatchObject({ code: "SCOPE_ESCALATION" });
  expect(fake.rows.identity_employees ?? []).toHaveLength(0);
});
it("keeps rejected applications and reasons without creating an account", async () => {
  const request = input(); await submitIdentityApplication(request, applicant);
  await decideIdentityApplication(request.id, { action: "reject", version: 0, reason: "Cần xác minh lại phạm vi công việc" }, "reviewer@example.com");
  expect((await trackIdentityApplication(request.id, request.trackingToken))).toMatchObject({ status: "REJECTED", reason: "Cần xác minh lại phạm vi công việc" });
  expect(fake.rows.identity_employees ?? []).toHaveLength(0);
});
it("requires a Google-bound application before approval", async () => {
  const request = input();
  fake.rows.identity_applications = [{ ...request, job: request.job, profile: null, requestedScopes: [scope], trackingHash: identityHash(request.trackingToken), fingerprint: "legacy", status: "PENDING", version: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
  await expect(decideIdentityApplication(request.id, decision, "reviewer@example.com")).rejects.toMatchObject({ code: "GOOGLE_IDENTITY_REQUIRED" });
  expect(fake.rows.identity_employees ?? []).toHaveLength(0);
});
it("records collisions and requires deliberate reviewer disambiguation", async () => {
  const first = input(); await submitIdentityApplication(first, applicant); await decideIdentityApplication(first.id, decision, "reviewer@example.com");
  const second = input(); await submitIdentityApplication(second, { sub: "google-sub-beta", email: "beta@gmail.com" });
  await expect(decideIdentityApplication(second.id, { ...decision, suffix: "2" }, "reviewer@example.com")).rejects.toMatchObject({ code: "SUFFIX_NOT_NEEDED" });
  await expect(decideIdentityApplication(second.id, decision, "reviewer@example.com")).rejects.toMatchObject({ code: "ID_COLLISION" });
  expect((await trackIdentityApplication(second.id, second.trackingToken)).status).toBe("ID_CONFLICT");
  await decideIdentityApplication(second.id, { ...decision, version: 1, suffix: "2" }, "reviewer@example.com");
  expect(fake.rows.identity_employees.map((row) => row.id)).toEqual(["alphanvgl", "alphanvgl-2"]);
});
it("rolls back profile/account/decision when audit writing fails", async () => {
  const request = input(); await submitIdentityApplication(request, applicant); fake.failAudit = true;
  await expect(decideIdentityApplication(request.id, decision, "reviewer@example.com")).rejects.toThrow("AUDIT_UNAVAILABLE");
  expect(fake.rows.identity_employees ?? []).toHaveLength(0); expect(fake.rows.identity_profiles ?? []).toHaveLength(0);
  expect(fake.rows.identity_applications[0].status).toBe("PENDING");
});
it("fails all application writes when Mongo is unavailable", async () => {
  fake.unavailable = true; await expect(submitIdentityApplication(input(), applicant)).rejects.toThrow("DB_UNAVAILABLE"); expect(fake.rows).toEqual({});
});
it("binds Support identity to the active verified session instead of form data", async () => {
  const request = input(); await submitIdentityApplication(request, applicant); await decideIdentityApplication(request.id, decision, "reviewer@example.com");
  const token = await createIdentitySession({ ...applicant, name: "Google Alpha" });
  const requestWithIdentity = requestWithCookie(token);
  const body = { mode: "freeform", serviceGroup: "NETWORK_VPN", rawText: "VPN không kết nối", fields: { department: "engineering", employeeId: "someone-else" }, confirmed: false, idempotencyKey: randomUUID() };
  await expect(requireEmployeeIdentity(body, requestWithIdentity)).rejects.toMatchObject({ code: "IDENTITY_MISMATCH", status: 403 });
  await expect(requireEmployeeIdentity({ ...body, fields: { ...body.fields, employeeId: "ALPHANVGL" } }, requestWithIdentity)).resolves.toMatchObject({ fields: { employeeId: "alphanvgl" } });
});
