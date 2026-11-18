import { displayId, statusLabel } from "@/domain/presentation";
import { labelForField } from "@/domain/catalog";
import type { SupportRequest, AuditEvent } from "@/domain/contracts";
import { AnswerBubble } from "./answer-bubble";
import { localized, useLocale } from "@/i18n/locale";
import { localizeKnownPolicyCopy } from "@/i18n/policy-copy";

export function AssistanceHistory({
  items,
  audience = "employee",
}: {
  items: SupportRequest["assistance"];
  audience?: "employee" | "reviewer";
}) {
  const { locale } = useLocale();
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <AnswerBubble
          item={item}
          audience={audience}
          key={`${item.timestamp}-${index}`}
        >
          <h2 className="text-lg font-bold">{localizeKnownPolicyCopy(item.summary, locale)}</h2>
          {audience === "reviewer" && (
            <p className="my-2 text-xs text-slate-500">
              {item.source === "cache" || item.answer?.cacheHit
                ? localized("Câu trả lời từ bộ nhớ đệm, đã kiểm tra lại", "Cached response, revalidated", locale)
                : item.source === "mock"
                  ? localized("Hướng dẫn mẫu", "Sample guidance", locale)
                  : item.source === "openai" || item.source === "gemini"
                    ? localized("Trợ lý giải thích theo tình huống; bước thao tác đã kiểm duyệt", "Contextual assistant response; action steps reviewed", locale)
                    : localized("Hướng dẫn an toàn", "Safe guidance", locale)}{" "}
              · {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.timestamp))}
            </p>
          )}
          {item.diagnosis && (
            <section
              className="support-diagnosis"
              aria-label={localized("Chẩn đoán khả dĩ", "Possible diagnosis", locale)}
            >
              <h3>{localized("Chẩn đoán khả dĩ", "Possible diagnosis", locale)}</h3>
              <p>{localizeKnownPolicyCopy(item.diagnosis, locale)}</p>
            </section>
          )}
          <h3 className="mt-4 text-base font-bold">
            {item.potentialFixes
              ? localized("Cách khắc phục có thể thử", "Possible fixes to try", locale)
              : localized("Các bước hỗ trợ", "Support steps", locale)}
          </h3>
          <ol className="ml-5 list-decimal space-y-3">
            {(item.potentialFixes ?? item.stepByStepInstructions).map(
              (step, stepIndex) => (
                <li key={step}>
                  {localizeKnownPolicyCopy(step, locale)}
                  {item.stepExplanations?.[stepIndex] && (
                    <p className="mt-1 text-sm text-slate-600">
                      {localizeKnownPolicyCopy(item.stepExplanations[stepIndex], locale)}
                    </p>
                  )}
                </li>
              ),
            )}
          </ol>
          {audience === "reviewer" && (
            <p className="mt-4 text-sm text-amber-800">{localizeKnownPolicyCopy(item.warning, locale)}</p>
          )}
          {audience === "reviewer" && (
            <p className="mt-2 text-sm">
              {localized("Kết quả mong đợi:", "Expected result:", locale)} {localizeKnownPolicyCopy(item.expectedResult, locale)}
            </p>
          )}
          <p className="mt-2 font-semibold">{localizeKnownPolicyCopy(item.nextQuestion, locale)}</p>
        </AnswerBubble>
      ))}
    </div>
  );
}
const progressLabels: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận yêu cầu",
  DECISION: "Đã kiểm tra yêu cầu",
  ANSWER: "Đã gửi câu trả lời",
  CLARIFICATION: "Đã cập nhật thông tin bổ sung",
  CONVERSATION: "Đã cập nhật cuộc trò chuyện",
  FEEDBACK: "Đã ghi nhận phản hồi",
  HANDOFF: "Đã chuyển nhân viên hỗ trợ",
  REVIEW: "Nhân viên đã cập nhật yêu cầu",
  STOP: "Đã dừng xử lý",
};
const progressLabelsEnglish: Record<string, string> = {
  RECEIVED: "Request received", DECISION: "Request reviewed", ANSWER: "Response sent",
  CLARIFICATION: "Additional information updated", CONVERSATION: "Conversation updated",
  FEEDBACK: "Feedback recorded", HANDOFF: "Sent to support staff", REVIEW: "Request updated by staff",
  STOP: "Processing stopped",
};
const auditActionEnglish: Record<string, string> = {
  CREATED: "Request created", SUBMITTED: "Request submitted", RECEIVED: "Request received",
  DECISION: "Request evaluated", ANSWER: "Response saved", CLARIFICATION: "Details updated",
  CONVERSATION: "Conversation updated", FEEDBACK: "Feedback recorded", HANDOFF: "Escalated to staff",
  REVIEW: "Staff reviewed request", STOP: "Processing stopped", APPROVE: "Request approved",
  REJECT: "Request rejected", OVERRIDE: "Decision overridden", FULFILL: "Workflow completed",
  IDENTITY_REQUESTED: "Employee ID requested", IDENTITY_APPROVED: "Employee ID approved",
};

export function RequestProgress({ events }: { events: AuditEvent[] }) {
  const { locale } = useLocale();
  return (
    <ol className="support-timeline space-y-4" aria-label={localized("Tiến trình hỗ trợ", "Support timeline", locale)}>
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-line pl-3 text-sm">
          <p className="font-semibold">
            {localized(progressLabels[event.action] ?? "Đã cập nhật yêu cầu", progressLabelsEnglish[event.action] ?? "Request updated", locale)}
          </p>
          <time dateTime={event.timestamp} className="text-slate-600">
            {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.timestamp))}
          </time>
          <p>{statusLabel(event.afterStatus, locale)}</p>
        </li>
      ))}
    </ol>
  );
}

// Staff surfaces only. The sender uses RequestProgress above.
export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  const { locale } = useLocale();
  return (
    <ol className="support-timeline space-y-4">
      {events.map((event) => (
        <li
          key={event.id}
          className="break-words border-l-2 border-line pl-3 text-sm"
        >
          <p className="font-semibold">
            {localized(progressLabels[event.action] ?? event.action, auditActionEnglish[event.action] ?? event.action, locale)} · {event.actor}
          </p>
          <time>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.timestamp))}</time>
          <p>
            {event.beforeStatus ? statusLabel(event.beforeStatus, locale) : "—"} →{" "}
            {statusLabel(event.afterStatus, locale)}
          </p>
          <p>{localizeKnownPolicyCopy(event.explanation, locale, true)}</p>
          <details className="mt-2">
            <summary className="cursor-pointer">
              {localized("Quy tắc, bằng chứng và thông tin còn thiếu", "Rules, evidence, and missing information", locale)}
            </summary>
            <p>{localized("Mã yêu cầu:", "Request ID:", locale)} {displayId(event.requestId)}</p>
            <p>
              {event.requestKind} · {event.riskLevel} · {event.bucket}
            </p>
            <p>{localized("Quy tắc:", "Rules:", locale)} {event.ruleIds.join(", ") || localized("Chờ đánh giá", "Pending evaluation", locale)}</p>
            <p>
              {localized("Thiếu:", "Missing:", locale)}{" "}
              {event.missingFields.map((field) => labelForField(field, locale)).join(", ") || localized("Không", "None", locale)}
            </p>
            <p>{localized("Policy:", "Policy:", locale)} {event.policyVersion}</p>
            <p>
              {localized("Phê duyệt:", "Approval:", locale)} {event.approvalStatus}
              {event.approvalReference ? ` · ${event.approvalReference}` : ""}
            </p>
            <p>
              {localized("Dấu hiệu đã che:", "Redaction markers:", locale)}{" "}
              {(event.redactions ?? []).join(", ") || localized("Không", "None", locale)}
            </p>
            <p>{localized("Bước tiếp theo:", "Next step:", locale)} {localizeKnownPolicyCopy(event.nextStep, locale)}</p>
            {(event.questions ?? []).map((question) => (
              <p key={question}>{localized("Câu hỏi:", "Question:", locale)} {localizeKnownPolicyCopy(question, locale)}</p>
            ))}

            {event.safeEvidence.map((evidence, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {evidence}
              </p>
            ))}
          </details>
        </li>
      ))}
    </ol>
  );
}
