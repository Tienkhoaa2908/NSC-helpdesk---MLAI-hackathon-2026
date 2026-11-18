"use client";
import type { CanonicalRequest, Decision } from "@/domain/contracts";
import { labelForField } from "@/domain/catalog";
import { intentName } from "@/domain/presentation";
import { Badge, Card } from "./ui";
import { jiraRoleProfile } from "@/domain/access-defaults";
import { localized, useLocale } from "@/i18n/locale";
import { localizeKnownPolicyCopy } from "@/i18n/policy-copy";
export function SupportResult({
  decision,
  canonical,
  audience = "employee",
  compact = false,
}: {
  decision: Decision;
  canonical: CanonicalRequest;
  audience?: "employee" | "reviewer";
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const policyCopy = (value: string, composed = false) =>
    localizeKnownPolicyCopy(value, locale, composed);
  const reason = audience === "reviewer"
    ? policyCopy(decision.adminReason, true)
    : policyCopy(decision.userReason, true);
  const title =
    decision.action === "AUTO_APPROVE"
      ? localized("Có thể hỗ trợ an toàn", "This request can be handled safely", locale)
      : decision.action === "NEEDS_INFORMATION"
        ? localized("Cần làm rõ thêm", "More information is needed", locale)
        : localized("Cần người phụ trách xem xét", "A support specialist must review this request", locale);
  const handlingLabels: Record<Decision["handlingMode"], [string, string]> = {
    GUIDE: ["Hướng dẫn tự thực hiện", "Self-service guidance"],
    LLM_ASSIST: ["Hướng dẫn từng bước", "Step-by-step guidance"],
    SIMULATED_WORKFLOW: ["Tiếp nhận xử lý mô phỏng", "Simulated workflow"],
    HUMAN_REVIEW: ["Nhân viên xem xét", "Staff review"],
  };
  const questions =
    audience === "reviewer"
      ? [...decision.questions, ...(decision.reviewerQuestions ?? [])]
      : decision.questions;
  return (
    <Card className="space-y-4" aria-label={localized("Kết quả quyết định", "Decision result", locale)}>
      <div className="flex flex-wrap items-center gap-3">
        <h2>{title}</h2>
        {audience === "reviewer" && !compact && (
          <Badge
            tone={decision.action === "AUTO_APPROVE" ? "success" : "warning"}
          >
            {decision.action}
          </Badge>
        )}
      </div>
      <p>{reason}</p>
      {jiraRoleProfile(canonical.entities.accessType) && (
        <p>
          {localized("Vai trò Jira trong demo:", "Demo Jira role:", locale)}{" "}
          {policyCopy(jiraRoleProfile(canonical.entities.accessType)?.description ?? "")}
          {localized(" Không gồm quản trị, xóa ticket, xuất dữ liệu hoặc phê duyệt đặc quyền; vẫn cần entitlement đúng phạm vi.", " It does not include administration, ticket deletion, data export, or privileged approval; the correct scoped entitlement is still required.", locale)}
        </p>
      )}
      {canonical.workEvidence && (
        <section aria-label={localized("Yêu cầu bổ sung dữ liệu", "Additional data required", locale)} className="space-y-3">
          {audience === "reviewer" && (
            <>
              <h3 className="font-semibold">{localized("Nguồn đã kiểm tra", "Sources checked", locale)}</h3>
              <ul className="list-disc pl-5">
                {canonical.workEvidence.sourceChecks.map((check) => (
                  <li key={check.source}>
                    <strong>{check.source}:</strong> {check.result}
                  </li>
                ))}
              </ul>
            </>
          )}
          {audience === "employee" && <p>{localized("Ứng dụng chưa tự mở tài liệu riêng từ liên kết. Hãy cung cấp nội dung liên quan đã ẩn thông tin nhạy cảm để tiếp tục.", "The app does not open private documents from links. To continue, provide relevant content with sensitive information removed.", locale)}</p>}
          <h3 className="font-semibold">{localized("Dữ liệu hoặc quyền cần bổ sung", "Additional data or access required", locale)}</h3>
          {canonical.workEvidence.requirements.map((item) => (
            <dl key={item.artifact} className="rounded-xl bg-paper p-3">
              <dt className="font-semibold">{localized("Hiện vật", "Artifact", locale)}</dt>
              <dd>{item.artifact}</dd>
              <dt className="font-semibold">{localized("Phạm vi / phiên bản", "Range / version", locale)}</dt>
              <dd>{item.range}</dd>
              <dt className="font-semibold">{localized("Quyền đọc", "Read access", locale)}</dt>
              <dd>{item.access}</dd>
              <dt className="font-semibold">{localized("Mục đích", "Purpose", locale)}</dt>
              <dd>{item.reason}</dd>
            </dl>
          ))}
          <p>{canonical.workEvidence.confidence}</p>
          <p>
            {localized("Chưa chuyển review. Sau khi có nguồn và công cụ phù hợp:", "Review has not been initiated. Once the source and appropriate tools are available:", locale)}{" "}
            {canonical.workEvidence.nextAction}
          </p>
        </section>
      )}
      {questions.length > 0 && (
        <ul className="list-disc space-y-2 pl-5">
          {questions.map((question) => (
            <li key={question}>{policyCopy(question)}</li>
          ))}
        </ul>
      )}
      <p>
        {decision.action === "ESCALATE" && audience === "employee"
          ? localized("Nhân viên hỗ trợ sẽ xem xét yêu cầu và lịch sử của bạn. Bạn có thể theo dõi tại liên kết yêu cầu.", "Support staff will review your request and its history. Use the request link to check for updates.", locale)
          : policyCopy(decision.nextStep)}
      </p>
      <p className="text-sm text-slate-600">
        {localized("Cách hỗ trợ:", "Handling:", locale)}{" "}
        {localized(handlingLabels[decision.handlingMode][0], handlingLabels[decision.handlingMode][1], locale)}
      </p>
      {audience === "reviewer" && !compact && (
        <details className="rounded-xl bg-paper p-4 text-sm">
          <summary>{localized("Quy tắc và thông tin đã hiểu", "Rules and extracted facts", locale)}</summary>
          <dl className="mt-3 space-y-2">
            <div>
              <dt>{localized("Nhu cầu", "Request", locale)}</dt>
              <dd>
                {intentName(canonical.intentLabel, locale)} · {canonical.intentLabel}
              </dd>
            </div>
            <div>
              <dt>Rule IDs</dt>
              <dd>{decision.ruleIds.join(", ")}</dd>
            </div>
            <div>
              <dt>{localized("Mức rủi ro / nhóm", "Risk level / bucket", locale)}</dt>
              <dd>
                {decision.riskLevel} / {decision.bucket}
              </dd>
            </div>
            <div>
              <dt>{localized("Dấu hiệu rủi ro", "Risk signals", locale)}</dt>
              <dd>{canonical.riskSignals.join(", ") || localized("Không phát hiện", "None detected", locale)}</dd>
            </div>
            <div>
              <dt>{localized("Thông tin còn thiếu", "Missing information", locale)}</dt>
              <dd>
                {decision.missingFields.map((field) => labelForField(field, locale)).join(", ") ||
                  localized("Không", "None", locale)}
              </dd>
            </div>
          </dl>
          <ul>
            {canonical.evidence.map((item, index) => (
              <li key={index} className="break-words whitespace-pre-wrap">
                <strong>{labelForField(item.field, locale)}: </strong>
                {item.quote}
              </li>
            ))}
          </ul>
        </details>
      )}
      {canonical.model.failure && (
        <p className="text-sm text-amber-900">
          {localized("Trợ lý hiện chưa thể đưa ra hướng dẫn đáng tin cậy. Yêu cầu được chuyển cho nhân viên hỗ trợ.", "The assistant could not provide reliable guidance. This request has been routed to support staff.", locale)}
          {audience === "reviewer" && ` (${canonical.model.failure})`}
        </p>
      )}
    </Card>
  );
}
