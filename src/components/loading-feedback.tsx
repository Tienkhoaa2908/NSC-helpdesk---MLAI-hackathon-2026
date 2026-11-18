"use client";
import { localized, useLocale } from "@/i18n/locale";

/** Indeterminate: the API does not expose a percentage or a reliable ETA. */
export function AiPending({ message, messageEn }: { message?: string; messageEn?: string }) {
  const { locale } = useLocale();
  const vi = message ?? "Đang chuẩn bị phản hồi, bạn chờ một chút nhé…";
  const en = messageEn ?? (message ? message : "Preparing your response. Please wait…");
  return <section className="ai-pending" aria-label={localized("VNG Support AI đang xử lý", "VNG Support AI is processing", locale)}>
    <div className="ai-pending-heading"><span className="ai-pending-mark" aria-hidden="true">✦</span><strong>VNG Support AI</strong></div>
    <p role="status">{localized(vi, en, locale)}</p>
    <div className="ai-progress" role="progressbar" aria-label={localized("Đang chờ phản hồi", "Waiting for a response", locale)} aria-valuetext={localized("Đang xử lý, chưa có thời gian hoàn tất dự kiến", "Processing, no completion time is available", locale)}><span /></div>
    <p className="ai-pending-note">{localized("Nội dung của bạn vẫn được giữ trong lúc chờ.", "Your content is retained while you wait.", locale)}</p>
  </section>;
}

export function ContentSkeleton({ label = "Đang tải nội dung…", labelEn, compact = false }: { label?: string; labelEn?: string; compact?: boolean }) {
  const { locale } = useLocale();
  return <div className={`content-skeleton${compact ? " is-compact" : ""}`} role="status">
    <span className="sr-only">{localized(label, labelEn ?? label, locale)}</span>
    <div aria-hidden="true">
      <span className="skeleton-bone skeleton-title" />
      <span className="skeleton-bone skeleton-line" />
      <span className="skeleton-bone skeleton-line skeleton-short" />
      {!compact && <div className="skeleton-cards">{[0, 1, 2].map((key) => <div className="skeleton-card" key={key}><span className="skeleton-bone skeleton-icon" /><span className="skeleton-bone skeleton-line" /><span className="skeleton-bone skeleton-line skeleton-short" /></div>)}</div>}
    </div>
  </div>;
}
