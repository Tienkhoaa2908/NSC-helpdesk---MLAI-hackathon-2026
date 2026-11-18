"use client";
import { useEffect, useState } from "react";
import { browserApi } from "@/lib/browser-api";
import type { ReviewerSummary } from "@/services/review-summary";
import { Button } from "./ui";
import { useLocale, localized, localizedError } from "@/i18n/locale";

export function ReviewSummary({ id, version }: { id: string; version: number }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const [summary, setSummary] = useState<ReviewerSummary | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    let active = true;
    setPending(true); setSummary(null); setError("");
    void browserApi<ReviewerSummary>(`/api/review/${id}/summary`, { version })
      .then(result => { if (active) setSummary(result); })
      .catch(cause => { if (active) setError(localizedError(cause, locale, "Không thể tải bản tóm tắt.", "Could not load the summary.")); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [id, version, retry, locale]);
  return <section className="it-surface it-intake" aria-labelledby="review-summary-heading" aria-busy={pending}>
    <div className="it-section-heading"><h2 id="review-summary-heading">{t("Tóm tắt yêu cầu", "Request summary")}</h2></div>
    {pending ? <div role="status"><p>{t("Trợ lý AI đang tóm tắt yêu cầu…", "The assistant is summarizing the request…")}</p><div className="ai-progress" role="progressbar" aria-label={t("Đang tóm tắt yêu cầu", "Summarizing request")}><span /></div></div> :
      summary?.summary ? <><p className="it-request-text">{summary.summary}</p>{summary.source === "mock" && <small>{t("Bản tóm tắt mô phỏng", "Simulated summary")}</small>}</> :
        <div><p role="status">{error || t("Chưa có bản tóm tắt AI hợp lệ. Bạn vẫn có thể đọc yêu cầu nguyên văn.", "No valid AI summary is available. You can still read the original request.")}</p><Button variant="quiet" onClick={() => setRetry(value => value + 1)}>{t("Tạo lại bản tóm tắt", "Retry summary")}</Button></div>}
  </section>;
}
