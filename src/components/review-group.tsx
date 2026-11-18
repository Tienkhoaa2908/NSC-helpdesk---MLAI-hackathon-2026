"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Send } from "lucide-react";
import type { RequestGroupDetail } from "@/domain/request-groups";
import { displayId, statusLabel } from "@/domain/presentation";
import { REVIEW_MESSAGE_MAX_LENGTH } from "@/domain/reviewer-messages";
import { BrowserApiError, browserApi } from "@/lib/browser-api";
import { Alert, Badge, Button, Textarea } from "./ui";
import { ContentSkeleton } from "./loading-feedback";
import { StaffWorkspace } from "./staff-workspace";
import { useLocale, localized, localizedError } from "@/i18n/locale";

type SendAttempt = { sendId: string; membership: string; text: string };
export function ReviewGroup({ id }: { id: string }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const [group, setGroup] = useState<RequestGroupDetail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const attempt = useRef<SendAttempt | null>(null);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const result = await browserApi<RequestGroupDetail>(`/api/review/groups/${id}`);
      if (current === sequence.current) setGroup(result);
    } catch (cause) {
      if (current === sequence.current) {
        setGroup(null);
        setError(localizedError(cause, locale, "Không thể tải nhóm yêu cầu.", "Could not load the request group."));
      }
    } finally { if (current === sequence.current) setLoading(false); }
  }, [id, locale]);
  useEffect(() => {
    void reload();
    const currentSequence = sequence;
    return () => { currentSequence.current++; };
  }, [reload]);
  async function send() {
    if (!group || pending || loading || !text.trim()) return;
    const body = attempt.current?.text === text.trim() ? attempt.current : {
      sendId: crypto.randomUUID(), membership: group.membership, text: text.trim(),
    };
    attempt.current = body;
    setPending(true); setError(""); setSent(null);
    try {
      const receipt = await browserApi<{ id: string; recipientCount: number }>(`/api/review/groups/${id}`, body);
      attempt.current = null;
      setText(""); setSent(receipt.recipientCount);
      await reload();
    } catch (cause) {
      setError(localizedError(cause, locale, "Không thể gửi câu trả lời.", "Could not send the response."));
      if (cause instanceof BrowserApiError && cause.code === "GROUP_CHANGED") {
        attempt.current = null;
        await reload();
      }
    } finally { setPending(false); }
  }
  return <StaffWorkspace active="review">
    <main className="it-content" data-guide-stage="reviewer-detail">
      <header className="it-detail-heading">
        <Link href="/review" className="it-back"><ArrowLeft size={16} />{t("Danh sách yêu cầu", "Request list")}</Link>
        {group && <div className="it-detail-title"><h1>{group.title}</h1>
          <Badge tone="warning">{statusLabel(group.members[0].status, locale)}</Badge>
        </div>}
      </header>
      {error && <Alert tone="error">{error}</Alert>}
      {sent !== null && <p role="status">{t(`Đã gửi đến ${sent} yêu cầu.`, `Sent to ${sent} requests.`)}</p>}
      {loading && !group && <ContentSkeleton />}
      {group ? <div className="it-detail-grid">
        <div className="it-request-content">
          <section className="it-surface it-intake" aria-label={t("Yêu cầu trong nhóm", "Requests in this group")}>
            <h2>{t("Yêu cầu trong nhóm", "Requests in this group")}</h2>
            <ul className="divide-y divide-slate-200">
              {group.members.map(member => <li key={member.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link className="font-bold text-orange-800 underline" href={`/review?requestId=${member.id}`}>{displayId(member.id)}</Link>
                  <time className="text-sm text-slate-500" dateTime={member.createdAt}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(member.createdAt))}</time>
                </div>
                {member.employeeId && <p className="text-sm">{t("Mã nhân viên:", "Employee ID:")} {member.employeeId}</p>}
                <p className="whitespace-pre-wrap break-words">{member.text}</p>
              </li>)}
            </ul>
          </section>
          {group.replies.length > 0 && <section className="it-surface it-intake" aria-label={t("Phản hồi đã gửi", "Responses sent")}>
            <h2>{t("Phản hồi đã gửi", "Responses sent")}</h2>
            <ol className="reviewer-messages">{group.replies.map(reply => <li key={reply.id}>
              <div><strong>{t(`${reply.recipientCount} yêu cầu`, `${reply.recipientCount} requests`)}</strong><time dateTime={reply.timestamp}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(reply.timestamp))}</time></div>
              <p className="whitespace-pre-wrap">{reply.text}</p>
            </li>)}</ol>
          </section>}
        </div>
        <aside className="it-action-panel it-surface" aria-label={t("Trả lời chung", "Shared response")}>
          <fieldset disabled={pending || loading}>
            <legend>{t("Trả lời chung", "Shared response")}</legend>
            <label className="it-reason">{t("Nội dung trả lời", "Response")}
              <Textarea rows={7} maxLength={REVIEW_MESSAGE_MAX_LENGTH} value={text} onChange={event => setText(event.target.value)} />
            </label>
            <div className="it-primary-actions"><Button disabled={!text.trim() || pending || loading} onClick={() => void send()}>
              <Send size={16} />{pending ? t("Đang gửi…", "Sending…") : t(`Gửi cho ${group.members.length} yêu cầu`, `Send to ${group.members.length} requests`)}
            </Button></div>
          </fieldset>
          <Button className="it-reload" variant="quiet" disabled={pending || loading} onClick={() => { setError(""); void reload(); }}><RefreshCw size={14} />{t("Tải lại hồ sơ", "Reload request")}</Button>
        </aside>
      </div> : !loading && <Button variant="secondary" onClick={() => { setError(""); void reload(); }}>{t("Tải lại hồ sơ", "Reload request")}</Button>}
    </main>
  </StaffWorkspace>;
}
