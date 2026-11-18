import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportRequest } from "@/domain/contracts";
import { listSupportRequests, getSupportRequest, insertSupportRequest, resetSupportTestStore, updateSupportRequest } from "@/lib/support-repository";
import { supportMetrics, supportPage, parseSupportQuery, auditPage, employeeIdSuggestions } from "@/lib/support-query";
import { groupedSupportPage } from "@/lib/support-groups";
import { incidentQueue, publishIncident } from "@/lib/support-incidents";
import { insertVerifyRun } from "@/lib/verify-repository";
import { supportVerifyCases } from "@/lib/support-verify";
import { withDemoReviewerDataScope } from "@/lib/support-http";
import { submitSupport } from "@/services/support";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("SUPPORT_STORAGE", "memory-demo");
  vi.stubEnv("AI_PROVIDER", "mock");
  resetSupportTestStore();
});

async function createRequest(rawText: string, employeeId = "EMP-TEST-01") {
  return submitSupport({
    rawText,
    fields: { department: "engineering", employeeId },
    confirmed: true,
    idempotencyKey: crypto.randomUUID(),
  });
}

describe("public demo reviewer data scope", () => {
  it("limits list, detail, audit, metrics, and mutations to linked server-owned Verify cases", async () => {
    const ordinary = await createRequest("ordinary synthetic request", "EMP-SECRET-01");
    const verifyCase = supportVerifyCases.find((item) => item.pack === "de-a-v3")!;
    const verifyRunId = crypto.randomUUID();
    const verifyRequestId = crypto.randomUUID();
    const verifyRecord: SupportRequest = {
      ...ordinary,
      id: verifyRequestId,
      fingerprint: `${ordinary.fingerprint}-verify`,
      input: {
        ...ordinary.input,
        fields: { ...ordinary.input.fields, employeeId: "EMP-DEMO-01" },
        verifyRunId,
        verifyCaseId: verifyCase.id,
      },
      originalQuestion: "server fixture request",
      events: ordinary.events.map((event) => ({ ...event, requestId: verifyRequestId })),
    };
    await insertSupportRequest(verifyRecord);
    await insertVerifyRun({
      id: verifyRunId,
      version: 0,
      pack: verifyCase.pack,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "COMPLETE",
      cases: [{ caseId: verifyCase.id, requestId: verifyRequestId }],
      results: [],
    });

    await withDemoReviewerDataScope("demo-reviewer:guest01", async () => {
      expect((await listSupportRequests()).map((row) => row.id)).toEqual([verifyRequestId]);
      expect(await getSupportRequest(ordinary.id)).toBeNull();
      expect((await getSupportRequest(verifyRequestId))?.id).toBe(verifyRequestId);
      await expect(updateSupportRequest(ordinary.id, ordinary.version, (row) => { row.status = "STOPPED"; }))
        .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
      await expect(updateSupportRequest(verifyRequestId, verifyRecord.version, (row) => { row.status = "STOPPED"; }))
        .resolves.toMatchObject({ status: "STOPPED" });
      expect((await supportPage(parseSupportQuery("http://localhost/api/support/requests?limit=20"))).items.map((row) => row.id))
        .toEqual([verifyRequestId]);
      expect(JSON.stringify(await groupedSupportPage(parseSupportQuery("http://localhost/api/support/requests?view=grouped"))))
        .not.toContain(ordinary.id);
      expect(await employeeIdSuggestions("EMP-SECRET")).toEqual([]);
      expect(await employeeIdSuggestions("EMP-DEMO")).toEqual(["emp-demo-01"]);
      expect((await auditPage(parseSupportQuery("http://localhost/api/support/events?limit=20"))).items)
        .toEqual(expect.arrayContaining([expect.objectContaining({ requestId: verifyRequestId })]));
      expect(await supportMetrics()).toMatchObject({ total: 1 });
      expect(await incidentQueue()).toEqual([]);
      await expect(publishIncident(crypto.randomUUID(), { version: 0, state: "INVESTIGATING", updateId: crypto.randomUUID() }, "demo-reviewer"))
        .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    });

    expect((await listSupportRequests()).map((row) => row.id)).toContain(ordinary.id);
    expect((await listSupportRequests()).map((row) => row.id)).toContain(verifyRequestId);
  });

  it("does not grant access to a row with a mismatched Verify case or request ID", async () => {
    const ordinary = await createRequest("ordinary request");
    const verifyCase = supportVerifyCases.find((item) => item.pack === "de-a-v3")!;
    const runId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    await insertSupportRequest({
      ...ordinary,
      id: requestId,
      fingerprint: `${ordinary.fingerprint}-tagged`,
      input: { ...ordinary.input, verifyRunId: runId, verifyCaseId: "not-a-known-case" },
    });
    await insertVerifyRun({
      id: runId,
      version: 0,
      pack: verifyCase.pack,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "COMPLETE",
      cases: [{ caseId: verifyCase.id, requestId }],
      results: [],
    });

    await withDemoReviewerDataScope("demo-reviewer:guest01", async () => {
      expect(await getSupportRequest(requestId)).toBeNull();
      expect(await listSupportRequests()).toEqual([]);
    });
  });

  it("keeps Admin reviewer access across ordinary requests", async () => {
    const ordinary = await createRequest("ordinary request");
    await withDemoReviewerDataScope("identity-admin:owner", async () => {
      expect((await listSupportRequests()).map((row) => row.id)).toContain(ordinary.id);
      expect((await getSupportRequest(ordinary.id))?.id).toBe(ordinary.id);
    });
  });
});
