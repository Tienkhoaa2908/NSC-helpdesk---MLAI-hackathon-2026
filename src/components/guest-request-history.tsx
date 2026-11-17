"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RequestStatus, SupportRequest } from "@/domain/contracts";
import { displayId } from "@/domain/presentation";
import { requesterApi } from "@/lib/requester-api";
import { browserApi } from "@/lib/browser-api";
import { guestRequestReceipts, pendingGuestRequestReceipts, rememberGuestRequest, removePendingGuestRequest, type PendingGuestRequestReceipt } from "@/lib/guest-request-history";
import { Button, Card } from "./ui";

const labels: Record<RequestStatus, string> = {
  RECEIVED: "Chờ xử lý · Pending", PROCESSING: "Đang xử lý · Pending", ESCALATED: "Chờ nhân viên xử lý · Pending",
  AUTO_APPROVED: "Đã có hướng dẫn · Approved", APPROVED_BY_HUMAN: "Đã duyệt · Approved",
  NEEDS_INFORMATION: "Cần bổ sung thông tin · Needs more information", REJECTED: "Đã từ chối · Rejected",
  STOPPED: "Đã dừng xử lý", COMPLETED: "Đã hoàn tất",
};
type Item = { id: string; token: string; status?: RequestStatus; version?: number; unavailable?: boolean };

export function GuestRequestHistory() {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState<PendingGuestRequestReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string[]>([]);
  const [recoveryErrors, setRecoveryErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true, running = false;
    async function load() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      setPending(pendingGuestRequestReceipts());
      const receipts = guestRequestReceipts();
      setTotal(receipts.length);
      const lastPage = Math.max(0, Math.ceil(receipts.length / 10) - 1);
      if (page > lastPage) { setPage(lastPage); running = false; return; }
      const visible = receipts.slice(page * 10, (page + 1) * 10);
      setLoading(true);
      setItems(previous => visible.map(receipt => previous.find(item => item.id === receipt.id) ?? receipt));
      const results: Item[] = await Promise.all(visible.map(async receipt => {
        try {
          const request = await requesterApi<SupportRequest>(`/api/support/track/${receipt.id}`, receipt.token);
          return { ...receipt, status: request.status, version: request.version };
        } catch { return { ...receipt, unavailable: true }; }
      }));
      if (active) {
        setItems(previous => results.map(item => {
          const old = previous.find(value => value.id === item.id);
          return old?.version !== undefined && item.version !== undefined && old.version > item.version ? { ...old, token: item.token } : item;
        }));
        setLoading(false);
      }
      running = false;
    }
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const reload = () => void load();
    window.addEventListener("focus", reload);
    window.addEventListener("storage", reload);
    document.addEventListener("visibilitychange", reload);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", reload); window.removeEventListener("storage", reload); document.removeEventListener("visibilitychange", reload); };
  }, [page, refresh]);
  async function recoverPendingReceipt(receipt: PendingGuestRequestReceipt) {
    if (recovering.includes(receipt.id)) return;
    setRecovering(current => [...current, receipt.id]);
    setRecoveryErrors(current => ({ ...current, [receipt.id]: "" }));
    try {
      const recovered = await browserApi<{ id: string; trackingToken: string }>(
        `/api/support/requests/${receipt.id}/receipt`, {}, { "x-tracking-proof": receipt.proof },
      );
      if (recovered.id !== receipt.id || !rememberGuestRequest(recovered.id, recovered.trackingToken))
        throw new Error("INVALID_RECEIPT");
      removePendingGuestRequest(receipt.id);
      setPending(pendingGuestRequestReceipts());
      setRefresh(value => value + 1);
    } catch {
      setRecoveryErrors(current => ({ ...current, [receipt.id]: "Chưa khôi phục được biên nhận. Giữ lại để thử lại hoặc xóa thông tin chờ khôi phục." }));
    } finally {
      setRecovering(current => current.filter(id => id !== receipt.id));
    }
  }
  function removePendingReceipt(id: string) {
    removePendingGuestRequest(id);
    setPending(pendingGuestRequestReceipts());
    setRecoveryErrors(current => { const next = { ...current }; delete next[id]; return next; });
  }
  if (!total && !pending.length) return null;
  return <section className="my-6" aria-label="Yêu cầu đã gửi" aria-busy={loading}>
    <Card>
      {pending.length > 0 && <section aria-label="Khôi phục biên nhận" className="mb-4 border-b border-slate-200 pb-4">
        <h3>Biên nhận đang chờ khôi phục</h3>
        <p className="text-sm text-slate-600">Nếu gửi bị ngắt quãng, dùng mã và khóa tạm trong phiên này để khôi phục liên kết. Nội dung yêu cầu không được lưu trong trình duyệt.</p>
        <ul className="divide-y divide-slate-100">
          {pending.map(receipt => <li key={receipt.id} className="py-3">
            <strong>{displayId(receipt.id)}</strong>
            {recoveryErrors[receipt.id] && <p role="alert" className="text-sm text-red-700">{recoveryErrors[receipt.id]}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button disabled={recovering.includes(receipt.id)} onClick={() => void recoverPendingReceipt(receipt)}>{recovering.includes(receipt.id) ? "Đang khôi phục…" : "Khôi phục liên kết"}</Button>
              <Button variant="quiet" disabled={recovering.includes(receipt.id)} onClick={() => removePendingReceipt(receipt.id)}>Xóa thông tin chờ khôi phục</Button>
            </div>
          </li>)}
        </ul>
      </section>}
      <div className="flex items-center justify-between gap-3"><h2>Yêu cầu đã gửi</h2><Button variant="quiet" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Cập nhật trạng thái</Button></div>
      {total > 0 && <ul className="divide-y divide-slate-100" aria-live="polite">
        {items.map(item => <li key={item.id} className="py-3"><Link className="font-bold text-orange-700" href={`/requests/${item.id}#token=${item.token}`}>{displayId(item.id)}</Link><p className="text-sm text-slate-600">{item.unavailable ? "Chưa tải được trạng thái. Mở yêu cầu hoặc thử cập nhật lại." : item.status ? labels[item.status] : "Đang tải trạng thái…"}</p></li>)}
      </ul>}
      {total > 10 && <div className="flex items-center gap-3"><Button variant="quiet" disabled={!page} onClick={() => setPage(value => value - 1)}>Trước</Button><span>Trang {page + 1}/{Math.ceil(total / 10)}</span><Button variant="quiet" disabled={(page + 1) * 10 >= total} onClick={() => setPage(value => value + 1)}>Tiếp</Button></div>}
    </Card>
  </section>;
}
