"use client";
import type { SentimentAssessment } from "@/domain/contracts";
import { sentimentFallbackMessages } from "@/domain/sentiment-diagnostics";
import { Badge, Card } from "@/components/ui";
import { useLocale, localized } from "@/i18n/locale";

const sentimentLabels: Record<SentimentAssessment["sentiment"], string> = {
  positive: "Tích cực",
  neutral: "Trung tính",
  negative: "Tiêu cực",
};
const sentimentLabelsEnglish: Record<SentimentAssessment["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};
const fallbackEnglish: Record<keyof typeof sentimentFallbackMessages, string> = {
  MOCK_PROVIDER: "This environment is using a simulated model.",
  NOT_CONFIGURED: "The model API is not fully configured. An administrator should check the provider, model, and API key.",
  AUTHENTICATION: "The model API rejected authentication (401). An administrator should update the hosting API key.",
  AUTHORIZATION: "The model API rejected access (403). An administrator should check model and project permissions.",
  BUDGET_EXHAUSTED: "A historical or test-only result was blocked by the previous model budget. Production has no application-level daily quota.",
  RATE_LIMIT: "The model service is rate-limiting requests. Try again later.",
  TIMEOUT: "The model did not respond in time. Try again later.",
  INVALID_OUTPUT: "The model response was malformed or truncated.",
  INVALID_EVIDENCE: "The model response did not include valid evidence from the submitted text.",
  MODEL_UNAVAILABLE: "No valid response was received from the model service. Try again later or contact an administrator.",
};

export function SentimentPreview({
  assessment,
}: {
  assessment: SentimentAssessment;
}) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const tone =
    assessment.sentiment === "positive"
      ? "success"
      : assessment.sentiment === "negative"
        ? "danger"
        : "neutral";
  const source =
    assessment.source === "model"
      ? `Model${assessment.model ? `: ${assessment.model}` : ""}`
      : assessment.source === "rule-based"
        ? t("Dự phòng theo luật", "Rule-based fallback")
        : t("Chưa có mô tả để phân tích", "No description to analyze");

  return (
    <Card
      className="space-y-3"
      role="region"
      aria-label={t("Phân tích cảm xúc nội bộ", "Internal sentiment analysis")}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{t("Cảm xúc người gửi", "Requester sentiment")}</h3>
        <Badge tone={tone}>{locale === "en" ? sentimentLabelsEnglish[assessment.sentiment] : sentimentLabels[assessment.sentiment]}</Badge>
        <span className="text-sm text-slate-600">{t("Nguồn:", "Source:")} {source}</span>
      </div>
      {assessment.evidence && (
        <p className="text-sm">
          <strong>{t("Dấu hiệu trong câu:", "Evidence in text:")}</strong> “{assessment.evidence}”
        </p>
      )}
      <p className="text-sm">
        <strong>{t("Lý do:", "Explanation:")}</strong> {assessment.explanation}
      </p>
      {assessment.source === "rule-based" && assessment.fallbackReason && (
        <p className="text-sm">
          <strong>{t("Lý do dùng dự phòng:", "Fallback reason:")}</strong>{" "}
          {locale === "en" ? fallbackEnglish[assessment.fallbackReason] : sentimentFallbackMessages[assessment.fallbackReason]}
          {assessment.model && <> {t("Model đã cấu hình:", "Configured model:")} {assessment.model}.</>}
        </p>
      )}
      <p className="text-xs text-slate-600">
        {t("Thông tin tham khảo cho nhân viên hỗ trợ; không quyết định quyền, ưu tiên hoặc trạng thái xử lý.", "For support staff reference only; it does not determine access, priority, or request status.")}
      </p>
    </Card>
  );
}
