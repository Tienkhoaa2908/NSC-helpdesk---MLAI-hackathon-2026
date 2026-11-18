"use client";
import Link from "next/link";
import { IncidentUpdates } from "./incident-panel";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { SupportRequest } from "@/domain/contracts";
import { allFields } from "@/domain/catalog";
import { displayId, statusLabel, optionName } from "@/domain/presentation";
import { requesterApi } from "@/lib/requester-api";
import { Alert, Button, Card, Textarea } from "./ui";
import { SupportResult } from "./support-result";
import { SupportField } from "./support-field";
import { AssistanceHistory, RequestProgress } from "./support-history";
import { AiPending, ContentSkeleton } from "./loading-feedback";
import { reviewerMessages } from "@/domain/reviewer-messages";
import { mergeTrackedRequest } from "@/domain/tracking-state";
import { localized, localizedError, useLocale } from "@/i18n/locale";
export function RequestDetail({ id }: { id: string }) {
  const { locale } = useLocale();
  const [request, setRequest] = useState<SupportRequest | null>(null),
    [error, setError] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [pending, setPending] = useState(false),
    [clarification, setClarification] = useState(""),
    [followup, setFollowup] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [step, setStep] = useState(0),
    [copied, setCopied] = useState(false);
  async function refresh() {
    if (!trackingToken) {
      setError(localized("Cần liên kết theo dõi đầy đủ để mở yêu cầu.", "The full tracking link is required to open this request.", locale));
      return;
    }
    try {
      setRequest(
        await requesterApi<SupportRequest>(`/api/support/track/${id}`, trackingToken),
      );
      setError("");
    } catch {
      setError(localized("Không thể tải yêu cầu. Thử tải lại.", "Could not load the request. Please try again.", locale));
    }
  }
  useEffect(() => {
    let current = true;
    setRequest(null);
    setError("");
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setTrackingToken(/^[a-f0-9]{64}$/i.test(token) ? token : "");
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setError(localized("Liên kết theo dõi thiếu mã truy cập. Hãy mở liên kết đầy đủ đã nhận sau khi gửi.", "The tracking link is missing its access token. Open the complete link you received after submitting.", locale));
      return () => { current = false; };
    }
    void requesterApi<SupportRequest>(`/api/support/track/${id}`, token)
      .then((result) => {
        if (current) setRequest(result);
      })
      .catch(() => {
        if (current) setError(localized("Không thể tải yêu cầu. Thử tải lại.", "Could not load the request. Please try again.", locale));
      });
    return () => {
      current = false;
    };
  }, [id, locale]);
  const canSync =
    request !== null && !!trackingToken && !pending &&
    !["COMPLETED", "STOPPED"].includes(request.status);
  useEffect(() => {
    if (!canSync) return;
    let current = true;
    let inFlight = false;
    async function sync() {
      if (
        !current || inFlight ||
        document.visibilityState === "hidden" || !navigator.onLine
      ) return;
      inFlight = true;
      try {
        const latest = await requesterApi<SupportRequest>(`/api/support/track/${id}`, trackingToken);
        if (current) {
          setRequest(previous => mergeTrackedRequest(previous, latest));
        }
      } catch {
        // Retry on the next tick without clearing drafts or an action error.
      } finally {
        inFlight = false;
      }
    }
    const timer = window.setInterval(() => void sync(), 3000);
    const resume = () => void sync();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [id, canSync, trackingToken]);
  async function update(path: string, body: object) {
    if (!request || pending) return;
    setPending(true);
    setError("");
    try {
      const updated = await requesterApi<SupportRequest>(
        `/api/support/requests/${id}/${path}`, trackingToken, { ...body, version: request.version },
      );
      setRequest({ ...updated, sharedReplies: request.sharedReplies,
        ...(updated.incidentId === request.incidentId ? { incident: request.incident } : {}) });
      setClarification("");
      setFollowup("");
      setFields({});
    } catch (error) {
      setError(localizedError(error, locale, "Không thể cập nhật. Thông tin bạn vừa nhập vẫn được giữ lại.", "Could not update the request. Your information is still available."));
    } finally {
      setPending(false);
    }
  }
  const active =
    request &&
    !["RECEIVED", "PROCESSING", "COMPLETED", "STOPPED", "REJECTED"].includes(
      request.status,
    );
  const latest = request?.assistance.at(-1);
  const canGuide = request?.status === "AUTO_APPROVED" && !!latest;
  const currentNote =
    request?.status === "REJECTED"
      ? localized("Yêu cầu đã bị từ chối. Xem lý do bên dưới hoặc tạo yêu cầu mới nếu tình huống thay đổi.", "The request was rejected. Review the reason below or submit a new request if the situation changes.", locale)
      : request?.status === "STOPPED"
        ? localized("Yêu cầu đã dừng. Các hướng dẫn trước đây chỉ còn trong lịch sử.", "This request is no longer being processed. Earlier guidance remains in its history.", locale)
        : request?.status === "COMPLETED"
          ? localized("Yêu cầu đã hoàn tất. Cảm ơn bạn đã cập nhật kết quả.", "This request is complete. Thank you for sharing the outcome.", locale)
          : request?.status === "APPROVED_BY_HUMAN"
            ? localized("Nhân viên đã duyệt, đang chờ hoàn tất xử lý mô phỏng.", "A staff member approved this request, the simulated workflow is pending completion.", locale)
            : "";
  return (
    <main
      className="page page-narrow space-y-6"
      data-guide-stage={
        request?.input.requesterMode === "guest" ? undefined : "sender-result"
      }
    >
      <div>
        <p className="eyebrow">{localized("THEO DÕI HỖ TRỢ", "REQUEST TRACKING", locale)}</p>
        <h1>{localized("Yêu cầu", "Request", locale)} {displayId(id)}</h1>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!request && !error && <ContentSkeleton label="Đang tải yêu cầu…" labelEn="Loading request…" />}
      {request && (
        <>
          <IncidentUpdates incident={request.incident} />
          <Card className="request-status" data-guide="sender-result">
            <p role="status">
              {localized("Trạng thái:", "Status:", locale)} <strong>{statusLabel(request.status, locale)}</strong>
            </p>
            <p className="text-sm text-slate-600">
              {localized("Cập nhật lúc", "Updated", locale)} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.updatedAt))}
            </p>
            <p>
              {currentNote ||
                (request.status === "ESCALATED"
                  ? localized("Nhân viên hỗ trợ sẽ xem xét yêu cầu. Dùng liên kết này để theo dõi cập nhật.", "Support staff will review this request. Use this link to check for updates.", locale)
                  : request.status === "NEEDS_INFORMATION"
                    ? localized("Điền các thông tin bạn biết bên dưới để chúng tôi hỗ trợ đúng hơn.", "Share the information you know below so we can help more accurately.", locale)
                    : localized("Làm theo hướng dẫn rồi cho chúng tôi biết kết quả.", "Follow the guidance and let us know the result.", locale))}
            </p>
            {request.status === "COMPLETED" && (
              <Image
                className="completion-mascot"
                src="/illustrations/vng-support-mascot-navi-wave.png"
                width={100}
                height={100}
                alt={localized("Navi nháy mắt cười vui vẻ và giơ một tay chào", "Navi winking and waving", locale)}
              />
            )}
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard
                  .writeText(window.location.href)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError(localized("Không thể sao chép. Bạn có thể sao chép địa chỉ trang trên trình duyệt.", "Could not copy the link. You can copy the page address from your browser.", locale)),
                  );
              }}
            >
              {copied ? localized("Đã sao chép liên kết", "Link copied", locale) : localized("Sao chép liên kết theo dõi", "Copy tracking link", locale)}
            </Button>
            <details>
              <summary>{localized("Mã yêu cầu", "Request ID", locale)}</summary>
              <p>{displayId(id)}</p>
            </details>
          </Card>
          <Card>
            <h2>{localized("Vấn đề bạn đã gửi", "Your request", locale)}</h2>
            {request.input.requesterMode === "guest" && request.input.guestDepartment && <p>{localized("Phòng ban demo (yêu cầu cũ):", "Demo department (legacy request):", locale)} {optionName(request.input.guestDepartment, locale)}</p>}
            <blockquote className="original-question">
              {request.originalQuestion ||
                request.input.rawText ||
                localized("Yêu cầu theo danh mục", "Categorized request", locale)}
            </blockquote>
          </Card>
          {reviewerMessages(request.events, request.sharedReplies).length > 0 && (
            <Card>
              <section aria-label={localized("Tin nhắn từ nhân viên", "Messages from staff", locale)} aria-live="polite" aria-relevant="additions">
                <h2>{localized("Phản hồi của nhân viên", "Staff responses", locale)}</h2>
                <ol className="reviewer-messages">
                  {reviewerMessages(request.events, request.sharedReplies).map(message => <li key={message.id}>
                    <div><strong>{localized("Nhân viên hỗ trợ", "Support staff", locale)}</strong><time dateTime={message.timestamp}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(message.timestamp))}</time></div>
                    <p>{message.text}</p>
                  </li>)}
                </ol>
              </section>
            </Card>
          )}
          {active &&
            request.decision &&
            request.canonical &&
            !latest?.answer && (
              <SupportResult
                decision={request.decision}
                canonical={request.canonical}
              />
            )}
          {active && latest && <AssistanceHistory items={[latest]} />}
          {pending && <AiPending message="Đang xử lý phản hồi và cập nhật yêu cầu…" messageEn="Processing your response and updating the request…" />}
          {request.knowledgeCandidate && (
            <Card>
              <h2>{localized("Gợi ý tri thức đã gửi rà soát", "Knowledge suggestion submitted for review", locale)}</h2>
              <p className="text-sm text-slate-600">
                {localized("Người phụ trách sẽ kiểm tra và biên tập trước khi hướng dẫn có thể được đưa vào kho tri thức.", "A reviewer will check and edit the suggestion before it can be added to the knowledge base.", locale)}
              </p>
            </Card>
          )}
          {request.stepExplanations?.map((item, index) => (
            <Card key={index}>
              <h2>{localized("Giải thích bước", "Explanation for step", locale)} {item.step + 1}</h2>
              <p>{item.text}</p>
            </Card>
          ))}
          {canGuide && (
            <Card className="followup-card">
              {request.feedback.at(-1)?.choice === "COMMENT" && (
                <p role="status">
                  {localized("Đã ghi nhận phản hồi. Yêu cầu vẫn mở, hãy xác nhận kết quả hoặc chọn chuyển cho nhân viên nếu cần.", "Your feedback was recorded. The request remains open, confirm the outcome or ask staff to review it.", locale)}
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void update("conversation", { question: followup });
                }}
              >
                <fieldset disabled={pending} className="space-y-4">
                  <div>
                    <h2>{localized("Hỏi tiếp về phản hồi này", "Ask a follow-up about this response", locale)}</h2>
                    <p className="text-sm text-slate-600">
                      {localized("Cho biết bước bạn đang vướng hoặc hỏi thêm về hướng dẫn. Bạn có thể yêu cầu nhân viên hỗ trợ bất cứ lúc nào.", "Tell us which step is unclear or ask about the guidance. You can request staff assistance at any time.", locale)}
                    </p>
                  </div>
                  <label>
                    {localized("Phản hồi về hướng dẫn", "Follow-up question", locale)}
                    <Textarea
                      aria-label={localized("Hỏi tiếp", "Ask a follow-up", locale)}
                      data-guide="sender-followup"
                      placeholder={localized("Ví dụ: Tôi đã vào được rồi, hoặc bước tiếp theo là gì?", "For example: I can sign in now. What should I do next?", locale)}
                      value={followup}
                      onChange={(event) => setFollowup(event.target.value)}
                      required
                      minLength={2}
                      maxLength={2000}
                    />
                  </label>
                  <Button type="submit" data-guide="sender-followup-send">
                    {localized("Gửi câu hỏi", "Send question", locale)}
                  </Button>
                  {latest?.answer && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void update("feedback", { choice: "RESOLVED" })
                      }
                    >
                      {localized("Tôi đã hiểu", "I understand", locale)}
                    </Button>
                  )}
                </fieldset>
              </form>
            </Card>
          )}
          {active && (
            <fieldset
              disabled={pending}
              className="space-y-4"
              data-guide={
                canGuide && !latest?.answer ? "sender-feedback" : undefined
              }
            >
              {canGuide && !latest?.answer && (
                <>
                  <div className="support-actions">
                    <Button
                      onClick={() =>
                        void update("feedback", { choice: "RESOLVED" })
                      }
                    >
                      {localized("A. Tôi đã làm được", "A. I completed it", locale)}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void update("feedback", { choice: "STILL_BROKEN" })
                      }
                    >
                      {localized("B. Vẫn còn lỗi", "B. The issue remains", locale)}
                    </Button>
                  </div>
                  <div className="explain-controls">
                    <label>
                      {localized("Bước cần giải thích", "Step to explain", locale)}
                      <select
                        value={step}
                        onChange={(event) =>
                          setStep(Number(event.target.value))
                        }
                      >
                        {latest!.stepByStepInstructions.map((_, index) => (
                          <option key={index} value={index}>
                            {localized("Bước", "Step", locale)} {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void update("feedback", { choice: "EXPLAIN", step })
                      }
                    >
                      {localized("C. Giải thích bước này", "C. Explain this step", locale)}
                    </Button>
                  </div>
                </>
              )}
              {request.status !== "ESCALATED" &&
                !request.canonical?.workEvidence &&
                request.status !== "APPROVED_BY_HUMAN" && (
                  <Button
                    variant="secondary"
                    onClick={() => void update("feedback", { choice: "ADMIN" })}
                  >
                    {canGuide
                      ? localized("D. Chuyển cho nhân viên hỗ trợ", "D. Ask support staff to review", locale)
                      : localized("Tôi vẫn cần hỗ trợ — Chuyển cho nhân viên", "I still need help — ask support staff to review", locale)}
                  </Button>
                )}
            </fieldset>
          )}
          {request.status === "NEEDS_INFORMATION" && (
            <Card>
              <h2>{localized("Bổ sung thông tin", "Add information", locale)}</h2>
              <p>
                {localized("Trả lời những mục bạn biết. Bạn có thể điền ô bên dưới mà không cần viết lại mô tả.", "Answer the fields you know. You can provide the details below without rewriting your description.", locale)}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void update("clarification", {
                    rawText: clarification,
                    fields,
                  });
                }}
              >
                <fieldset disabled={pending} className="space-y-4">
                  {(
                    request.decision?.clarificationFields ??
                    request.decision?.missingFields?.slice(0, 3) ??
                    []
                  )
                    .slice(0, 3)
                    .map((field) =>
                      field === "verifiedApproval"
                        ? "approvalReference"
                        : field,
                    )
                    .filter((field) => allFields.has(field))
                    .map((field) => (
                      <SupportField
                        key={field}
                        field={field}
                        value={fields[field] ?? ""}
                        onChange={(value) =>
                          setFields((current) => ({
                            ...current,
                            [field]: value,
                          }))
                        }
                      />
                    ))}
                  <label>
                    {localized("Thông tin làm rõ (không bắt buộc)", "Additional details (optional)", locale)}
                    <Textarea
                      aria-label={localized("Thông tin làm rõ", "Additional details", locale)}
                      data-guide="sender-followup"
                      value={clarification}
                      onChange={(event) => setClarification(event.target.value)}
                      maxLength={4000}
                    />
                  </label>
                  <Button type="submit" data-guide="sender-followup-send">
                    {localized("Gửi bổ sung", "Send details", locale)}
                  </Button>
                </fieldset>
              </form>
            </Card>
          )}
          <details className="panel">
            <summary data-guide="sender-history">
              {localized("Lịch sử yêu cầu và hướng dẫn", "Request and guidance history", locale)}
            </summary>
            {request.decision && request.canonical && currentNote && (
              <SupportResult
                decision={request.decision}
                canonical={request.canonical}
              />
            )}
            <AssistanceHistory
              items={
                active ? request.assistance.slice(0, -1) : request.assistance
              }
            />
            <RequestProgress events={request.events} />
          </details>
          {!active && (
            <Link
              className="button primary"
              href="/send-help"
            >
              {localized("Gửi yêu cầu mới", "Submit another request", locale)}
            </Link>
          )}
        </>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => void refresh()}
      >
        {localized("Tải lại yêu cầu", "Reload request", locale)}
      </Button>
    </main>
  );
}
