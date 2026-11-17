const key = "vng-guest-requests-v2";
const pendingKey = "vng-pending-request-receipts-v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[a-f0-9]{64}$/i;
export type GuestRequestReceipt = { id: string; token: string };
export type PendingGuestRequestReceipt = { id: string; proof: string };
let memory: GuestRequestReceipt[] = [];
let writeFailed = false;
let pendingMemory: PendingGuestRequestReceipt[] = [];
let pendingWriteFailed = false;

/** Store only each request ID and its bearer capability; request data stays server-side. */
export function guestRequestReceipts(): GuestRequestReceipt[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (Array.isArray(saved)) {
      const receipts = saved.filter((item): item is GuestRequestReceipt =>
        typeof item === "object" && item !== null &&
        typeof (item as GuestRequestReceipt).id === "string" && uuid.test((item as GuestRequestReceipt).id) &&
        typeof (item as GuestRequestReceipt).token === "string" && tokenPattern.test((item as GuestRequestReceipt).token),
      ).map(item => ({ id: item.id.toLowerCase(), token: item.token }));
      memory = unique(writeFailed ? [...memory, ...receipts] : receipts);
    }
  } catch { /* A blocked store still permits tracking in this tab. */ }
  return memory.map(item => ({ ...item }));
}

export function rememberGuestRequest(id: string, token: string) {
  if (!uuid.test(id) || !tokenPattern.test(token)) return false;
  memory = unique([{ id: id.toLowerCase(), token }, ...guestRequestReceipts()]);
  try { window.localStorage.setItem(key, JSON.stringify(memory)); writeFailed = false; }
  catch { writeFailed = true; /* Keep the receipt available in this tab if storage is blocked. */ }
  return true;
}

/** Keep only id and a random recovery proof until the submit receipt is confirmed. */
export function pendingGuestRequestReceipts(): PendingGuestRequestReceipt[] {
  if (!pendingWriteFailed) {
    try {
      const saved: unknown = JSON.parse(window.sessionStorage.getItem(pendingKey) || "[]");
      if (Array.isArray(saved)) {
        pendingMemory = uniquePending(saved.filter((item): item is PendingGuestRequestReceipt =>
          typeof item === "object" && item !== null &&
          typeof (item as PendingGuestRequestReceipt).id === "string" && uuid.test((item as PendingGuestRequestReceipt).id) &&
          typeof (item as PendingGuestRequestReceipt).proof === "string" && tokenPattern.test((item as PendingGuestRequestReceipt).proof),
        ).map(item => ({ id: item.id.toLowerCase(), proof: item.proof.toLowerCase() })));
      }
    } catch { pendingWriteFailed = true; /* Keep the entries in this tab if storage is blocked. */ }
  }
  return pendingMemory.map(item => ({ ...item }));
}

export function rememberPendingGuestRequest(id: string, proof: string) {
  if (!uuid.test(id) || !tokenPattern.test(proof)) return false;
  const normalizedId = id.toLowerCase();
  const existing = pendingGuestRequestReceipts().find(item => item.id === normalizedId);
  if (existing) return existing.proof === proof.toLowerCase();
  pendingMemory = uniquePending([...pendingMemory, { id: normalizedId, proof: proof.toLowerCase() }]);
  try { window.sessionStorage.setItem(pendingKey, JSON.stringify(pendingMemory)); pendingWriteFailed = false; }
  catch { pendingWriteFailed = true; /* Retain the proof in memory while this tab is open. */ }
  return true;
}

export function removePendingGuestRequest(id: string) {
  pendingMemory = pendingGuestRequestReceipts().filter(item => item.id !== id.toLowerCase());
  try { window.sessionStorage.setItem(pendingKey, JSON.stringify(pendingMemory)); pendingWriteFailed = false; }
  catch { pendingWriteFailed = true; }
}

function unique(receipts: GuestRequestReceipt[]) {
  const seen = new Set<string>();
  return receipts.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniquePending(receipts: PendingGuestRequestReceipt[]) {
  const seen = new Set<string>();
  return receipts.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
