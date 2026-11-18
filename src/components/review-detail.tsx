"use client";

import Link from "next/link";
import { IncidentUpdates } from "./incident-panel";
import { ReviewDrafts } from "./review-drafts";
import { ReviewSummary } from "./review-summary";
import { REVIEW_MESSAGE_MAX_LENGTH } from "@/domain/reviewer-messages";
import { divisionLabels, requestDivision } from "@/domain/support-divisions";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { browserApi } from "@/lib/browser-api";
import type { InformationDraft } from "@/services/review-information";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  ShieldAlert,
  X,
  OctagonPause,
  RefreshCw,
  Send,
} from "lucide-react";
import type { RequestStatus, SupportRequest } from "@/domain/contracts";
import { canReview, type ReviewAction } from "@/domain/transitions";
import {
  displayId,
  optionName,
  intentName,
  statusLabel,
  serviceGroupName,
} from "@/domain/presentation";
import { labelForField } from "@/domain/catalog";
import { Badge, Button, Textarea } from "./ui";
import { SentimentPreview } from "./sentiment-preview";
import { SupportResult } from "./support-result";
import { AssistanceHistory, AuditTimeline } from "./support-history";
import { useLocale, localized, localizedError } from "@/i18n/locale";

const tabs = [
  { id: "evidence", label: ["Thông tin & bằng chứng", "Details and evidence"], icon: FileText },
  { id: "assistance", label: ["Hướng dẫn đã gửi", "Guidance sent"], icon: CircleHelp },
  { id: "history", label: ["Lịch sử xử lý", "Activity history"], icon: Clock3 },
] as const;
type Tab = (typeof tabs)[number]["id"];
const labels: Record<ReviewAction, string> = {
  SEND_MESSAGE: "Gửi cho người gửi",
  APPROVE: "Duyệt yêu cầu",
  REJECT: "Từ chối",
  REQUEST_INFORMATION: "Hỏi thêm thông tin",
  STOP: "Dừng xử lý",
  OVERRIDE: "Điều chỉnh quyết định",
  FULFILL: "Hoàn tất mô phỏng",
};
const actionLabels: Record<ReviewAction, string> = {
  SEND_MESSAGE: "Send a message",
  APPROVE: "Approve request",
  REJECT: "Reject",
  REQUEST_INFORMATION: "Ask for information",
  STOP: "Stop processing",
  OVERRIDE: "Override decision",
  FULFILL: "Complete simulated workflow",
};

// Presentation of existing guards only. The API remains the authority for transitions.
function blockedReason(
  request: SupportRequest,
  action: ReviewAction,
  target: RequestStatus,
  locale: "vi" | "en",
) {
  if (!canReview(request.status, action))
    return localized("Thao tác không áp dụng cho trạng thái hiện tại.", "This action is not available for the current status.", locale);
  if (action === "APPROVE") return "";
  const approval =
    action === "FULFILL" ||
    (action === "OVERRIDE" && target === "APPROVED_BY_HUMAN");
  if (approval && request.decision?.bucket === "SECURITY_RISK")
    return localized("Yêu cầu có rủi ro bảo mật. Chọn hỏi thêm, từ chối hoặc dừng xử lý.", "This request has a security risk. Ask for more information, reject it, or stop processing.", locale);
  if (approval && request.decision?.ruleIds.includes("FAIL-003"))
    return localized("Chưa thể duyệt vì bằng chứng hoặc phạm vi AI trích xuất chưa được xác minh. Cần bổ sung thông tin để kiểm tra lại.", "The extracted evidence or scope has not been verified. Request more information before approval.", locale);
  if (
    action === "FULFILL" &&
    (request.status === "NEEDS_INFORMATION" ||
      request.decision?.action === "NEEDS_INFORMATION" ||
      request.decision?.missingFields.length)
  )
    return localized("Cần bổ sung đủ thông tin trước khi duyệt hoặc hoàn tất.", "More information is required before approval or completion.", locale);
  if (
    action === "FULFILL" &&
    request.status === "AUTO_APPROVED" &&
    request.decision?.handlingMode !== "SIMULATED_WORKFLOW"
  )
    return localized("Hướng dẫn cần phản hồi của người dùng để hoàn tất.", "The requester must respond to the guidance before it can be completed.", locale);
  return "";
}

export function ReviewDetail({
  request,
  reason,
  setReason,
  target,
  setTarget,
  pending,
  onAct,
  onReload,
}: {
  request: SupportRequest;
  reason: string;
  setReason: (value: string) => void;
  target: RequestStatus;
  setTarget: (value: RequestStatus) => void;
  pending: boolean;
  onAct: (action: ReviewAction) => Promise<boolean>;
  onReload: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => localized(vi, en, locale);
  const [tab, setTab] = useState<Tab>("evidence");
  const [savedAction, setSavedAction] = useState<ReviewAction | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [information, setInformation] = useState<InformationDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const draftSequence = useRef(0);
  useEffect(() => {
    setInformation(null); setDrafting(false); setDraftError("");
    const sequence = draftSequence;
    return () => { sequence.current++; };
  }, [request.id, request.version]);
  const decision = request.decision;
  const canonical = request.canonical;
  const approveBlock = blockedReason(request, "APPROVE", target, locale);
  async function askForInformation() {
    if (drafting) return;
    const current = ++draftSequence.current;
    setDrafting(true); setDraftError("");
    try {
      const draft = await browserApi<InformationDraft>(`/api/review/${request.id}/information`, { version: request.version });
      if (current !== draftSequence.current) return;
      setReason(draft.text); setInformation(draft);
    } catch (cause) {
      if (current === draftSequence.current) setDraftError(localizedError(cause, locale, "Không thể soạn câu hỏi bổ sung.", "Could not draft a follow-up question."));
    } finally { if (current === draftSequence.current) setDrafting(false); }
  }
  async function act(action: ReviewAction) {
    setSavedAction(null);
    if (await onAct(action)) {
      setSavedAction(action);
      setTab("history");
    }
  }
  function selectTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`it-tab-${tabs[next].id}`)?.focus();
  }
  function actionButton(
    action: ReviewAction,
    variant: "primary" | "secondary" | "danger" = "secondary",
  ) {
    const block = blockedReason(request, action, target, locale);
    const composeInformation = action === "REQUEST_INFORMATION" && !information;
    const needsReason = action !== "APPROVE" && !composeInformation;
    const reasonReady = reason.trim().length >= (action === "SEND_MESSAGE" ? 1 : 8);
    const Icon = {
      SEND_MESSAGE: Send,
      APPROVE: Check,
      REQUEST_INFORMATION: CircleHelp,
      REJECT: X,
      STOP: OctagonPause,
      OVERRIDE: RefreshCw,
      FULFILL: Check,
    }[action];
    return (
      <Button
        variant={variant}
        disabled={
          pending || (drafting && action !== "APPROVE") || (needsReason && !reasonReady) || Boolean(block)
        }
        title={
          block ||
          (needsReason && !reasonReady
            ? action === "SEND_MESSAGE"
              ? t("Nhập tin nhắn trước khi gửi.", "Enter a message before sending.")
              : t("Nhập lý do tối thiểu 8 ký tự để thực hiện.", "Enter a reason of at least 8 characters.")
            : localized(labels[action], actionLabels[action], locale))
        }
        onClick={() => void (composeInformation ? askForInformation() : act(action))}
      >
        <Icon size={16} />
        {action === "REQUEST_INFORMATION" && information ? t("Gửi yêu cầu bổ sung", "Send information request") : localized(labels[action], actionLabels[action], locale)}
      </Button>
    );
  }
  return (
    <>
      <header className="it-detail-heading">
        <Link href="/review" className="it-back">
          <ArrowLeft size={16} />
          <span>← {t("Danh sách yêu cầu", "Request list")}</span>
        </Link>
        <div className="it-detail-title">
          <div>
            <h1>{displayId(request.id)}</h1>
            <p>
              {canonical
                ? serviceGroupName(canonical.serviceGroup, locale)
                : t("Yêu cầu hỗ trợ", "Support request")}
            </p>
          </div>
          <div role="status" className="it-current-status">
            <Badge
              tone={
                request.status === "ESCALATED"
                  ? "warning"
                  : request.status === "COMPLETED"
                    ? "success"
                    : "neutral"
              }
            >
              {statusLabel(request.status, locale)}
            </Badge>
            {savedAction && <small>{savedAction === "SEND_MESSAGE"
              ? t("Đã gửi tin nhắn vào hồ sơ người gửi. Trạng thái yêu cầu được giữ nguyên.", "Message added to the request. Its status is unchanged.")
              : t("Đã lưu quyết định và gửi tin nhắn vào hồ sơ người gửi", "Decision saved and message added to the request")}</small>}
          </div>
        </div>
      </header>
      <div className="it-detail-grid">
        <div className="it-request-content">
          <section className="it-surface it-intake" aria-labelledby="it-intake-heading">
            <div className="it-section-heading">
              <h2 id="it-intake-heading" data-guide="reviewer-evidence">{t("Nội dung yêu cầu", "Request text")}</h2>
              <small>{t("Thông tin nhạy cảm đã được che", "Sensitive information is redacted")}</small>
            </div>
            <p className="it-request-text whitespace-pre-wrap">{request.originalQuestion || request.input.rawText || t("Người gửi chọn yêu cầu theo danh mục.", "The requester selected a categorized request.")}</p>
          {!request.originalQuestion && !request.input.rawText && <dl className="it-request-fields">{Object.entries(request.input.fields).filter(([key]) => !["employeeId", "department"].includes(key)).map(([key, value]) => <div key={key}><dt>{labelForField(key, locale)}</dt><dd>{optionName(value, locale)}</dd></div>)}</dl>}
          </section>
          <ReviewSummary key={request.id} id={request.id} version={request.version} />
          {!!request.sharedReplies?.length && <section className="it-surface it-intake" aria-label={t("Phản hồi chung", "Shared response")}>
            <h2>{t("Phản hồi chung", "Shared response")}</h2>
            <ol className="reviewer-messages">{request.sharedReplies.map(reply => <li key={reply.id}>
              <time dateTime={reply.timestamp}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(reply.timestamp))}</time>
              <p className="whitespace-pre-wrap">{reply.text}</p>
            </li>)}</ol>
          </section>}
          <ReviewDrafts key={`${request.id}:${request.version}`} id={request.id} version={request.version} disabled={pending || drafting} onChoose={text => { setReason(text); setInformation(null); }} />
        </div>
        <aside
          className="it-action-panel it-surface"
          id="review-actions"
          aria-label={t("Thao tác xử lý", "Review actions")}
        >
          <fieldset disabled={pending}>
            <legend>{t("Thao tác xử lý", "Review actions")}</legend>
            {approveBlock && (
              <div className="it-block-notice">
                <ShieldAlert size={17} />
                <span>{approveBlock}{canReview(request.status, "SEND_MESSAGE") && t(" Bạn vẫn có thể gửi tin nhắn cho người gửi bên dưới.", " You can still send the requester a message below.")}</span>
              </div>
            )}
            <label className="it-reason">
              {t("Tin nhắn cho người gửi", "Message to requester")}
              <Textarea
                disabled={drafting}
                rows={reason.length > 300 ? 8 : 3}
                maxLength={REVIEW_MESSAGE_MAX_LENGTH}
                value={reason}
                data-guide="reviewer-reason"
                placeholder={t("Chọn gợi ý hoặc nhập tin nhắn…", "Choose a suggestion or write a message…")}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {drafting && <p role="status">{t("Đang soạn tin nhắn hỏi thông tin còn thiếu…", "Drafting a message to request missing information…")}</p>}
            {draftError && <p role="alert">{draftError}</p>}
            {information && <p role="status" className="it-field-hint">{information.source === "openai" || information.source === "gemini" ? t(`Bản nháp từ ${information.model || "AI"}`, `Drafted by ${information.model || "AI"}`) : information.source === "mock" ? t("Bản nháp mô phỏng", "Simulated draft") : t("Mẫu hỏi bổ sung dự phòng", "Fallback information request")}. {t("Bạn có thể sửa trước khi gửi.", "You can edit it before sending.")}</p>}
            <div data-guide="reviewer-actions">
              <div className="it-primary-actions">
                {actionButton("SEND_MESSAGE", "primary")}
                <p className="it-field-hint">{t("Tin nhắn hiện trên trang theo dõi của người gửi, gửi tin nhắn không thay đổi trạng thái yêu cầu.", "The requester can see this message on the tracking page. Sending a message does not change the request status.")}</p>
                {actionButton("APPROVE")}
                {actionButton("REQUEST_INFORMATION")}
              </div>
              {canReview(request.status, "FULFILL") && (
                <div className="it-fulfill">
                  {actionButton("FULFILL", "primary")}
                </div>
              )}
              <div className="it-stop-actions">
                {actionButton("REJECT", "danger")}
                {actionButton("STOP", "danger")}
              </div>
              <div className="it-override">
                <label>
                  {t("Trạng thái sau điều chỉnh", "Status after override")}
                  <select
                    disabled={drafting}
                    value={target}
                    onChange={(event) =>
                      setTarget(event.target.value as RequestStatus)
                    }
                  >
                    <option value="NEEDS_INFORMATION">
                      {t("Cần bổ sung thông tin", "More information needed")}
                    </option>
                    <option value="REJECTED">{t("Từ chối", "Rejected")}</option>
                    <option value="APPROVED_BY_HUMAN">{t("Đã duyệt", "Approved")}</option>
                  </select>
                </label>
                {actionButton("OVERRIDE")}
                {blockedReason(request, "OVERRIDE", target, locale) && (
                  <p className="it-field-hint">
                    {blockedReason(request, "OVERRIDE", target, locale)}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
          <Button variant="quiet" data-guide="reviewer-history" aria-expanded={recordOpen} aria-controls="review-full-record" onClick={() => setRecordOpen(value => !value)}>
            {recordOpen ? t("Ẩn hồ sơ chi tiết", "Hide request record") : t("Xem lịch sử & bằng chứng", "View history and evidence")}
          </Button>
          <Button
            className="it-reload"
            variant="quiet"
            disabled={pending}
            onClick={() => void onReload()}
          >
            <RefreshCw size={14} />
            {t("Tải lại hồ sơ", "Reload request")}
          </Button>
        </aside>
        <section id="review-full-record" hidden={!recordOpen} className="it-record it-surface" aria-label={t("Hồ sơ xử lý", "Request record")}>
          <div role="tablist" aria-label={t("Thông tin hồ sơ", "Request details")} className="it-tabs">
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`it-tab-${item.id}`}
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`it-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => selectTab(event, index)}
              >
                <item.icon size={16} />
                <span>{localized(item.label[0], item.label[1], locale)}</span>
                {item.id === "history" && (
                  <small>{request.events.length}</small>
                )}
              </button>
            ))}
          </div>
          <div
            id="it-panel-evidence"
            role="tabpanel"
            aria-labelledby="it-tab-evidence"
            hidden={tab !== "evidence"}
            tabIndex={0}
            className="it-tab-content"
          >
            <h2>{t("Thông tin đối chiếu", "Review details")}</h2>
            <IncidentUpdates incident={request.incident} />
            {request.supportNeed && <p className="it-field-hint">{request.supportNeed.note} Lượt báo còn vướng: {request.supportNeed.reportedFailedRounds}. Không tự tăng ưu tiên.</p>}
            <dl className="it-request-fields">
              {request.input.requesterMode === "guest" && request.input.guestDepartment && <div><dt>{t("Phòng ban giả lập (yêu cầu cũ)", "Demo department (legacy request)")}</dt><dd>{optionName(request.input.guestDepartment, locale)} · {t("Không xác minh danh tính", "Identity not verified")}</dd></div>}
              {Object.entries(request.input.fields).map(([key, value]) => (
                <div key={key}>
                  <dt>{labelForField(key, locale)}</dt>
                  <dd>{optionName(value, locale)}</dd>
                </div>
              ))}
              <div>
                <dt>{t("Tiếp nhận lúc", "Received")}</dt>
                <dd>
                  {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(request.createdAt))}
                </dd>
              </div>
            </dl>
            {decision && canonical && <SupportResult decision={decision} canonical={canonical} audience="reviewer" compact />}
            {request.knowledgeCandidate && (
              <section
                className="it-knowledge-candidate"
                aria-label={t("Gợi ý tri thức chờ rà soát", "Knowledge suggestion pending review")}
              >
                <h3>{t("Gợi ý tri thức · chờ rà soát", "Knowledge suggestion · pending review")}</h3>
                <p>
                  <strong>{t("Vấn đề:", "Issue:")}</strong> {request.knowledgeCandidate.symptom}
                </p>
                <p>
                  <strong>{t("Phản hồi:", "Feedback:")}</strong>{" "}
                  {request.knowledgeCandidate.employeeFeedback}
                </p>
                <p>{request.knowledgeCandidate.answerSummary}</p>
                {!!request.knowledgeCandidate.steps.length && (
                  <ol className="list-decimal pl-5">
                    {request.knowledgeCandidate.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                )}
                <p className="it-field-hint">
                  {t("Đề xuất này chưa được thêm vào kho tri thức. Người phụ trách cần kiểm tra nguồn và biên tập thành phiên bản được duyệt theo hướng dẫn quản trị tri thức.", "This suggestion has not been added to the knowledge base. A reviewer must verify its source and prepare an approved revision under the knowledge governance process.")}
                </p>
              </section>
            )}
            {decision && canonical ? (
              <>
                <dl className="it-evidence-grid">
                  <div>
                    <dt>{t("Nhu cầu đã hiểu", "Interpreted request")}</dt>
                    <dd>{intentName(canonical.intentLabel, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("Nhóm tiếp nhận", "Assigned team")}</dt>
                    <dd>{localized(divisionLabels[requestDivision(request)], requestDivision(request) === "IT" ? "IT" : requestDivision(request) === "HR" ? "Human Resources" : "Commercial", locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("Quy tắc áp dụng", "Applied rules")}</dt>
                    <dd>{decision.ruleIds.join(", ") || t("Chưa có", "None")}</dd>
                  </div>
                  <div>
                    <dt>{t("Thông tin còn thiếu", "Missing information")}</dt>
                    <dd>
                      {decision.missingFields.map((field) => labelForField(field, locale)).join(", ") || t("Không", "None")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Mức rủi ro / nhóm", "Risk level / bucket")}</dt>
                    <dd>
                      {decision.riskLevel} / {decision.bucket}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Dấu hiệu rủi ro", "Risk signals")}</dt>
                    <dd>
                      {canonical.riskSignals.join(", ") || t("Không phát hiện", "None detected")}
                    </dd>
                  </div>
                </dl>
                {canonical.evidence.length > 0 && (
                  <div className="it-evidence-quotes">
                    <h3>{t("Bằng chứng từ yêu cầu", "Evidence from request")}</h3>
                    {canonical.evidence.map((item, index) => (
                      <blockquote key={index}>
                        <strong>{labelForField(item.field, locale)}</strong>
                        <p>{item.quote}</p>
                      </blockquote>
                    ))}
                  </div>
                )}
                <p className="it-policy-version">
                  {t("Phiên bản chính sách:", "Policy version:")} {decision.policyVersion}
                </p>
              </>
            ) : (
              <p>
                {t("Chưa có kết quả đánh giá. Tải lại hồ sơ để kiểm tra cập nhật.", "No evaluation result is available. Reload the request to check for updates.")}
              </p>
            )}
            <section className="space-y-4" aria-label={t("Chẩn đoán nội bộ", "Internal analysis")}>
              <h3>{t("Phân tích dành cho nhân viên hỗ trợ", "Support staff analysis")}</h3>
              {request.intakeSentiment ? (
                <SentimentPreview assessment={request.intakeSentiment} />
              ) : (
                <p className="text-sm text-slate-600">
                  {t("Hồ sơ này chưa lưu phân tích cảm xúc khi tiếp nhận.", "No sentiment assessment was saved for this request.")}
                </p>
              )}
              {request.feedback
                .filter((item) => item.sentimentAssessment)
                .map((item, index) => (
                  <div key={`${item.timestamp}-${index}`}>
                    <p className="text-sm text-slate-600">
                      {t("Phản hồi lúc", "Feedback received")} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(item.timestamp))}
                    </p>
                    <SentimentPreview assessment={item.sentimentAssessment!} />
                  </div>
                ))}
            </section>
            <details className="it-reference">
              <summary>{t("Mã đối chiếu kỹ thuật", "Technical reference")}</summary>
              <p>
                {displayId(request.id)} · {t("phiên bản", "version")} {request.version}
              </p>
            </details>
          </div>
          <div
            id="it-panel-assistance"
            role="tabpanel"
            aria-labelledby="it-tab-assistance"
            hidden={tab !== "assistance"}
            tabIndex={0}
            className="it-tab-content"
          >
            <h2>{t("Hướng dẫn đã gửi", "Guidance sent")}</h2>
            {!request.assistance.length && (
              <p>{t("Chưa gửi hướng dẫn tự thực hiện cho yêu cầu này.", "No self-service guidance has been sent for this request.")}</p>
            )}
            <AssistanceHistory items={request.assistance} audience="reviewer" />
            {request.stepExplanations?.map((item, index) => (
              <div className="it-step-explanation" key={index}>
                <h3>{t("Giải thích bước", "Step explanation")} {item.step + 1}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div
            id="it-panel-history"
            role="tabpanel"
            aria-labelledby="it-tab-history"
            hidden={tab !== "history"}
            tabIndex={0}
            className="it-tab-content"
          >
            <div id="request-audit">
              <h2>{t("Lịch sử xử lý", "Activity history")}</h2>
              <AuditTimeline events={request.events} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
