"use client";
import { useEffect, useState } from "react";
import { browserApi } from "@/lib/browser-api";
import type { ReviewDrafts as Drafts } from "@/services/review-drafts";
import { Button } from "./ui";
import { useLocale, localized, localizedError } from "@/i18n/locale";
export function ReviewDrafts({ id, version, onChoose, disabled = false }: { id: string; version: number; onChoose: (text: string) => void; disabled?: boolean }) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(""); setDrafts(null);
    void browserApi<Drafts>(`/api/review/${id}/drafts`, { version })
      .then(result => { if (active) setDrafts(result); })
      .catch(cause => { if (active) setError(localizedError(cause, locale, "Không thể tải gợi ý xử lý.", "Could not load response suggestions.")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, version, retry, locale]);
  return <section className="review-drafts it-surface it-intake" aria-label={t("Gợi ý cách xử lý", "Response suggestions")} aria-busy={busy}>
    <h2>{t("Gợi ý cách xử lý", "Response suggestions")}</h2>
    {busy && <p role="status">{t("Đang soạn 2 gợi ý xử lý…", "Drafting two response suggestions…")}</p>}
    {error && <div><p role="alert">{error}</p><Button variant="quiet" onClick={() => setRetry(value => value + 1)}>{t("Tải lại gợi ý", "Reload suggestions")}</Button></div>}
    {drafts && <div aria-live="polite">
      <p className="it-field-hint">{drafts.source === "openai" || drafts.source === "gemini" ? t("Gợi ý từ AI", "AI-generated suggestions") : drafts.source === "mock" ? t("Gợi ý mô phỏng", "Simulated suggestions") : t("Mẫu hướng dẫn dự phòng", "Fallback guidance template")}</p>
      {drafts.options.map((text, i) => <button type="button" disabled={disabled} className="review-draft-option" key={i} onClick={() => onChoose(text)}><strong>{t(`Gợi ý xử lý ${i + 1}`, `Response suggestion ${i + 1}`)}</strong><span className="whitespace-pre-wrap line-clamp-3">{text}</span></button>)}
    </div>}
  </section>;
}
