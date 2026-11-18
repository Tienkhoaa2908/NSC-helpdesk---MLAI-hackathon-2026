"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { IncidentView } from "@/lib/support-incidents";
import { incidentLabels, incidentMessages } from "@/domain/shared-support";
import { browserApi } from "@/lib/browser-api";
import { Button } from "./ui";
import { useLocale, localized, localizedError } from "@/i18n/locale";
const incidentLabelsEnglish = { NETWORK_OUTAGE: "Network outage", POWER_OUTAGE: "Power outage" } as const;
const incidentMessagesEnglish = {
  INVESTIGATING: "Support staff are investigating the incident in this area. You do not need to submit the same incident again, the next update will appear here. If you see smoke, smell burning, or face immediate danger, stop and contact on-site safety staff.",
  MONITORING: "Support staff are monitoring the incident in this area. You can safely check your connection or device using the guidance you received. Do not repair power sources or network equipment, or disable security controls.",
  RESOLVED: "Support staff marked the shared incident as resolved. Check your situation and confirm the result on your request. If the issue remains, keep this request and ask for individual support.",
} as const;
export function IncidentUpdates({ incident }: { incident?: IncidentView }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  if (!incident) return null;
  return <section className="it-surface p-4 space-y-3" aria-label={t("Cập nhật sự cố chung", "Shared incident updates")}>
    <h2>{localized(incidentLabels[incident.topic], incidentLabelsEnglish[incident.topic], locale)} · {incident.site}</h2>
    <p>{t("Hồ sơ của bạn được liên kết với sự cố cùng khu vực. Cập nhật tại đây áp dụng chung, mã theo dõi và kết quả của bạn vẫn riêng.", "Your request is linked to an incident in the same area. Updates here are shared, your tracking link and outcome remain private to your request.")}</p>
    {(incident.expired || incident.closed) && <p>{incident.expired ? t("Nhóm đã hết thời hạn 24 giờ.", "The group expired after 24 hours.") : t("Nhóm đã đóng.", "The group is closed.")} {t("Thông tin dưới đây là lịch sử, chưa xác nhận vấn đề riêng của bạn đã hết.", "Updates below are historical and do not confirm that your individual issue is resolved.")}</p>}
    {!incident.updates.length && <p>{t("Đang chờ nhân viên cập nhật. Việc gộp nhóm không xác nhận nguyên nhân sự cố hoặc đã gửi thông báo bên ngoài.", "Waiting for a staff update. Grouping requests does not confirm the incident cause or send external notifications.")}</p>}
    <ol className="space-y-2">{incident.updates.map(update => <li key={update.id}><time dateTime={update.at}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(update.at))}</time><p>{update.message}</p></li>)}</ol>
  </section>;
}
type Group = IncidentView & { count: number; representativeId: string | null };
export function IncidentQueue() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const [groups, setGroups] = useState<Group[]>([]), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<{ id: string; state: keyof typeof incidentMessages; updateId: string; version: number } | null>(null);
  async function refresh() {
    try { setGroups(await browserApi<Group[]>("/api/review/incidents")); setError(""); }
    catch (cause) { setError(localizedError(cause, locale, "Không thể tải danh sách sự cố.", "Could not load incident groups.")); }
  }
  useEffect(() => { let current = true; void browserApi<Group[]>("/api/review/incidents").then(rows => { if (current) setGroups(rows); }).catch(cause => { if (current) setError(localizedError(cause, locale, "Không thể tải danh sách sự cố.", "Could not load incident groups.")); }); return () => { current = false; }; }, [locale]);
  async function publish(group: Group, state: keyof typeof incidentMessages) {
    const body = attempt?.id === group.id && attempt.state === state ? attempt : { id: group.id, state, version: group.version, updateId: crypto.randomUUID() };
    setAttempt(body); setBusy(true); setError("");
    try { await browserApi("/api/review/incidents", body); setAttempt(null); await refresh(); }
    catch (cause) { setError(localizedError(cause, locale, "Không thể đăng cập nhật sự cố.", "Could not publish the incident update.")); }
    finally { setBusy(false); }
  }
  return <details className="it-surface p-4" open={groups.some(g => g.count > 1)}>
    <summary>{t("Sự cố chung · ", "Shared incidents · ")}{groups.filter(g => g.count > 0).length} {t("nhóm đang mở", "open groups")}</summary>
    <p className="it-field-hint">{t("Một cập nhật áp dụng cho mọi hồ sơ trong nhóm, không tự đóng hồ sơ cá nhân. Tối đa 50 nhóm mới nhất, mọi hồ sơ vẫn có trong danh sách.", "One update applies to every request in a group and does not close individual requests. The latest 50 groups are shown, all requests remain in the queue.")}</p>
    <Button variant="secondary" disabled={busy} onClick={() => { setAttempt(null); void refresh(); }}>{t("Tải lại nhóm", "Reload groups")}</Button>
    {error && <p role="alert">{error}</p>}
    {groups.filter(g => g.count > 0).map(group => <article key={group.id} className="my-4 space-y-2">
      <h3>{localized(incidentLabels[group.topic], incidentLabelsEnglish[group.topic], locale)} · {group.site} · {group.count} {t("hồ sơ", "requests")}</h3>
      {group.representativeId && <Link href={`/review?requestId=${group.representativeId}`}>{t("Xem hồ sơ đại diện", "View representative request")}</Link>}
      <p>{group.updates.at(-1)?.message || t("Chưa có cập nhật chung.", "No shared updates yet.")}</p>
      <div className="flex flex-wrap gap-2">{(["INVESTIGATING", "MONITORING", "RESOLVED"] as const).map(state =>
        <Button key={state} variant="secondary" disabled={busy} title={localized(incidentMessages[state], incidentMessagesEnglish[state], locale)} onClick={() => void publish(group, state)}>
          {localized({ INVESTIGATING: "Thông báo đang kiểm tra", MONITORING: "Thông báo đang theo dõi", RESOLVED: "Đã khắc phục sự cố chung" }[state], { INVESTIGATING: "Mark as investigating", MONITORING: "Mark as monitoring", RESOLVED: "Mark as resolved" }[state], locale)}
        </Button>)}</div>
    </article>)}
  </details>;
}
