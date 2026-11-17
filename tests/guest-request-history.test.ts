import { afterEach, beforeEach, expect, it, vi } from "vitest";

const saved = new Map<string, string>();
const savedSession = new Map<string, string>();
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const firstToken = "a".repeat(64);
const secondToken = "b".repeat(64);
beforeEach(() => {
  vi.resetModules(); saved.clear(); savedSession.clear();
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) },
    sessionStorage: { getItem: (key: string) => savedSession.get(key), setItem: (key: string, value: string) => savedSession.set(key, value) },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("persists only unique ID/token receipts across reloads", async () => {
  const history = await import("@/lib/guest-request-history");
  history.rememberGuestRequest(first, firstToken); history.rememberGuestRequest(second, secondToken); history.rememberGuestRequest(first, firstToken);
  expect(history.guestRequestReceipts()).toEqual([{ id: first, token: firstToken }, { id: second, token: secondToken }]);
  vi.resetModules();
  expect((await import("@/lib/guest-request-history")).guestRequestReceipts()).toEqual([{ id: first, token: firstToken }, { id: second, token: secondToken }]);
  expect(saved.get("vng-guest-requests-v2")).toBe(JSON.stringify([{ id: first, token: firstToken }, { id: second, token: secondToken }]));
});
it("does not treat legacy ID-only storage as requester access", async () => {
  saved.set("vng-guest-requests-v1", JSON.stringify([first]));
  saved.set("vng-guest-requests-v2", JSON.stringify([first]));
  expect((await import("@/lib/guest-request-history")).guestRequestReceipts()).toEqual([]);
});
it.each(["{broken", "null", "{}", '["javascript:alert(1)", 7, null]', JSON.stringify([{ id: first, token: "short" }])])("ignores malformed or incomplete stored values: %s", async value => {
  saved.set("vng-guest-requests-v2", value);
  const history = await import("@/lib/guest-request-history");
  expect(history.guestRequestReceipts()).toEqual([]);
  history.rememberGuestRequest("https://external.invalid/tracker", firstToken);
  history.rememberGuestRequest(first, "wrong-token");
  expect(history.guestRequestReceipts()).toEqual([]);
});
it("reads updates written by another tab and respects cleared storage", async () => {
  const history = await import("@/lib/guest-request-history");
  history.rememberGuestRequest(first, firstToken);
  saved.set("vng-guest-requests-v2", JSON.stringify([{ id: second, token: secondToken }, { id: first, token: firstToken }]));
  expect(history.guestRequestReceipts()).toEqual([{ id: second, token: secondToken }, { id: first, token: firstToken }]);
  saved.clear(); expect(history.guestRequestReceipts()).toEqual([]);
});
it("keeps the current tab usable when browser storage is blocked", async () => {
  vi.stubGlobal("window", { get localStorage() { throw Error("blocked"); } });
  const history = await import("@/lib/guest-request-history");
  history.rememberGuestRequest(first, firstToken);
  expect(history.guestRequestReceipts()).toEqual([{ id: first, token: firstToken }]);
});
it("retains the new receipt in this tab when quota blocks writes", async () => {
  saved.set("vng-guest-requests-v2", JSON.stringify([{ id: first, token: firstToken }]));
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => saved.get(key), setItem: () => { throw Error("quota"); } } });
  const history = await import("@/lib/guest-request-history");
  history.rememberGuestRequest(second, secondToken);
  expect(history.guestRequestReceipts()).toEqual([{ id: second, token: secondToken }, { id: first, token: firstToken }]);
});
it("stores only pending request IDs and random recovery proofs in session storage", async () => {
  const history = await import("@/lib/guest-request-history");
  const proof = "c".repeat(64);
  expect(history.rememberPendingGuestRequest(first, proof)).toBe(true);
  expect(history.pendingGuestRequestReceipts()).toEqual([{ id: first, proof }]);
  expect(savedSession.get("vng-pending-request-receipts-v1")).toBe(JSON.stringify([{ id: first, proof }]));
  vi.resetModules();
  expect((await import("@/lib/guest-request-history")).pendingGuestRequestReceipts()).toEqual([{ id: first, proof }]);
});
it("keeps separate pending proofs and removes them only on explicit confirmation", async () => {
  const history = await import("@/lib/guest-request-history");
  const firstProof = "c".repeat(64), secondProof = "d".repeat(64);
  history.rememberPendingGuestRequest(first, firstProof);
  history.rememberPendingGuestRequest(second, secondProof);
  history.removePendingGuestRequest(first);
  expect(history.pendingGuestRequestReceipts()).toEqual([{ id: second, proof: secondProof }]);
  expect(savedSession.get("vng-pending-request-receipts-v1")).toBe(JSON.stringify([{ id: second, proof: secondProof }]));
});
