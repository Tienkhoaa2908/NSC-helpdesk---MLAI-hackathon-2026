import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as preview } from "@/app/api/support/preview/route";
import { POST as submit, GET as queue } from "@/app/api/support/requests/route";
import { GET as reviewerDetail } from "@/app/api/support/requests/[id]/route";
import { GET as requesterDetail } from "@/app/api/support/track/[id]/route";
import { POST as receiptRecovery } from "@/app/api/support/requests/[id]/receipt/route";
import { POST as conversation } from "@/app/api/support/requests/[id]/conversation/route";
import { POST as clarification } from "@/app/api/support/requests/[id]/clarification/route";
import { POST as feedback } from "@/app/api/support/requests/[id]/feedback/route";
import { getSupportRequest, getSupportRequestTrackingHash, getSupportRequestTrackingProofHash, resetSupportTestStore, updateSupportRequest } from "@/lib/support-repository";
import { submitSupport } from "@/services/support";

const secret = "1".repeat(64);
const wrongToken = "2".repeat(64);
const requestContext = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (url: string, body: unknown, token?: string, proof?: string) => new Request(url, {
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { "x-tracking-token": token } : {}), ...(proof ? { "x-tracking-proof": proof } : {}) },
  body: JSON.stringify(body),
});
const read = (url: string, token?: string) => new Request(url, {
  headers: token ? { "x-tracking-token": token } : {},
});

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SUPPORT_ACCESS_MODE", "public-demo");
  vi.stubEnv("SUPPORT_TRACKING_SECRET", secret);
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("AI_TEST_MAX_ATTEMPTS", "20");
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("IDENTITY_MONGODB_URI", "");
  resetSupportTestStore();
});
afterEach(() => vi.unstubAllEnvs());

async function createRequest(rawText = "VPN không kết nối", trackingProof = randomBytes(32).toString("hex")) {
  const idempotencyKey = crypto.randomUUID();
  const previewResponse = await preview(post("http://localhost/api/support/preview", {
    requesterMode: "guest", guestDepartment: "it", rawText, idempotencyKey,
  }));
  expect(previewResponse.status).toBe(200);
  const previewBody = await previewResponse.json();
  expect(JSON.stringify(previewBody)).not.toContain("trackingToken");
  const body = { ...previewBody.data.input, confirmed: true };
  const response = await submit(post("http://localhost/api/support/requests", body, undefined, trackingProof));
  expect(response.status).toBe(201);
  const receipt = (await response.json()).data as { id: string; trackingToken: string; version: number };
  return { body, receipt, trackingProof };
}

it("issues a stable tracking receipt, requires proof to recover it, and keeps public reviewer reads unchanged", async () => {
  const { body, receipt, trackingProof } = await createRequest();
  expect(receipt.trackingToken).toMatch(/^[a-f0-9]{64}$/);

  const stored = await getSupportRequest(receipt.id);
  const hash = createHash("sha256").update(receipt.trackingToken).digest("hex");
  const proofHash = createHash("sha256").update(trackingProof).digest("hex");
  expect(await getSupportRequestTrackingHash(receipt.id)).toBe(hash);
  expect(await getSupportRequestTrackingProofHash(receipt.id)).toBe(proofHash);
  expect(JSON.stringify(stored)).not.toContain(receipt.trackingToken);
  expect(JSON.stringify(stored)).not.toContain(hash);
  expect(JSON.stringify(stored)).not.toContain(trackingProof);
  expect(JSON.stringify(stored)).not.toContain(proofHash);

  const missingProofReplay = await submit(post("http://localhost/api/support/requests", body));
  expect(missingProofReplay.status).toBe(422);
  expect(JSON.stringify(await missingProofReplay.json())).not.toContain("trackingToken");
  const wrongProofReplay = await submit(post("http://localhost/api/support/requests", body, undefined, wrongToken));
  expect(wrongProofReplay.status).toBe(404);
  expect(JSON.stringify(await wrongProofReplay.json())).not.toContain("trackingToken");

  const replay = await submit(post("http://localhost/api/support/requests", body, undefined, trackingProof));
  expect(replay.status).toBe(201);
  expect((await replay.json()).data.trackingToken).toBe(receipt.trackingToken);

  const wrongRecovery = await receiptRecovery(post(`http://localhost/api/support/requests/${receipt.id}/receipt`, {}, undefined, wrongToken), requestContext(receipt.id));
  const missingRecovery = await receiptRecovery(post(`http://localhost/api/support/requests/${receipt.id}/receipt`, {}), requestContext(receipt.id));
  expect(wrongRecovery.status).toBe(404);
  expect(missingRecovery.status).toBe(404);
  expect(JSON.stringify(await wrongRecovery.json())).not.toContain("trackingToken");
  const recovery = await receiptRecovery(post(`http://localhost/api/support/requests/${receipt.id}/receipt`, {}, undefined, trackingProof), requestContext(receipt.id));
  expect(recovery.status).toBe(200);
  expect((await recovery.json()).data.trackingToken).toBe(receipt.trackingToken);

  const missing = await requesterDetail(read(`http://localhost/api/support/track/${receipt.id}`), requestContext(receipt.id));
  const wrong = await requesterDetail(read(`http://localhost/api/support/track/${receipt.id}`, wrongToken), requestContext(receipt.id));
  expect(missing.status).toBe(404);
  expect(wrong.status).toBe(404);
  const tracked = await requesterDetail(read(`http://localhost/api/support/track/${receipt.id}`, receipt.trackingToken), requestContext(receipt.id));
  expect(tracked.status).toBe(200);
  const trackedBody = await tracked.text();
  expect(trackedBody).not.toContain(receipt.trackingToken);
  expect(trackedBody).not.toContain(hash);

  const reviewer = await reviewerDetail(read(`http://localhost/api/support/requests/${receipt.id}`), requestContext(receipt.id));
  expect(reviewer.status).toBe(200);
  const reviewerBody = await reviewer.text();
  expect(reviewerBody).not.toContain(receipt.trackingToken);
  expect(reviewerBody).not.toContain(hash);
  const publicQueue = await queue(read("http://localhost/api/support/requests"));
  expect(publicQueue.status).toBe(200);
  const queueBody = await publicQueue.text();
  expect(queueBody).not.toContain(receipt.trackingToken);
  expect(queueBody).not.toContain(hash);

  const other = await createRequest("Printer không hoạt động");
  const crossRequest = await requesterDetail(
    read(`http://localhost/api/support/track/${other.receipt.id}`, receipt.trackingToken),
    requestContext(other.receipt.id),
  );
  expect(crossRequest.status).toBe(404);
});

it("requires a matching request token on every requester follow-up mutation", async () => {
  const { receipt, trackingProof } = await createRequest();
  const hash = createHash("sha256").update(receipt.trackingToken).digest("hex");
  const proofHash = createHash("sha256").update(trackingProof).digest("hex");
  const context = requestContext(receipt.id);
  const endpoints = [
    { route: conversation, body: { version: receipt.version, question: "Tôi vẫn cần hỗ trợ" } },
    { route: clarification, body: { version: receipt.version, rawText: "", fields: {} } },
    { route: feedback, body: { version: receipt.version, choice: "ADMIN" } },
  ];
  for (const { route, body } of endpoints) {
    expect((await route(post(`http://localhost/api/support/requests/${receipt.id}/action`, body), context)).status).toBe(404);
    expect((await route(post(`http://localhost/api/support/requests/${receipt.id}/action`, body, wrongToken), context)).status).toBe(404);
  }
  const correctTokenBadClarification = await clarification(
    post(`http://localhost/api/support/requests/${receipt.id}/clarification`, { version: receipt.version, rawText: "", fields: {} }, receipt.trackingToken),
    context,
  );
  expect(correctTokenBadClarification.status).toBe(422);
  const updated = await updateSupportRequest(receipt.id, receipt.version, row => {
    row.events.push({ ...row.events.at(-1)!, id: crypto.randomUUID(), action: "TEST_REVIEW_UPDATE", timestamp: new Date().toISOString() });
  });
  expect(await getSupportRequestTrackingHash(receipt.id)).toBe(hash);
  expect(await getSupportRequestTrackingProofHash(receipt.id)).toBe(proofHash);
  const conversationResponse = await conversation(
    post(`http://localhost/api/support/requests/${receipt.id}/conversation`, { version: updated.version, question: "Tôi vẫn cần hỗ trợ" }, receipt.trackingToken),
    context,
  );
  expect(conversationResponse.status).toBe(200);
  const conversationResult = (await conversationResponse.json()).data;
  const validFeedback = await feedback(
    post(`http://localhost/api/support/requests/${receipt.id}/feedback`, { version: conversationResult.version, choice: "ADMIN" }, receipt.trackingToken),
    context,
  );
  expect(validFeedback.status).toBe(200);
});

it("fails closed for Production when the dedicated tracking key is missing", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPPORT_TRACKING_SECRET", "");
  const response = await submit(post("http://localhost/api/support/requests", {
    requesterMode: "guest", rawText: "VPN không kết nối", confirmed: true, idempotencyKey: crypto.randomUUID(),
  }, undefined, randomBytes(32).toString("hex")));
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe("TRACKING_UNAVAILABLE");
});

it("does not issue a receipt for a legacy request without stored recovery hashes", async () => {
  const row = await submitSupport({ requesterMode: "guest", rawText: "VPN không kết nối", confirmed: true, idempotencyKey: crypto.randomUUID() });
  const response = await receiptRecovery(post(`http://localhost/api/support/requests/${row.id}/receipt`, {}, undefined, randomBytes(32).toString("hex")), requestContext(row.id));
  expect(response.status).toBe(404);
  expect(JSON.stringify(await response.json())).not.toContain("trackingToken");
});
