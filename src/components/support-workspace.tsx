"use client";
import { incidentTopic } from "@/domain/shared-support";
import { companyServiceGroups, isCompanyService } from "@/domain/company-support";
import { useEffect, useState } from "react";
import { rememberPendingGuestRequest, removePendingGuestRequest } from "@/lib/guest-request-history";
import { identityApi } from "@/components/identity-ui";
import { useRouter } from "next/navigation";
import {
  catalog,
  fieldOptions,
  allFields,
  commonFields,
  labelForField,
} from "@/domain/catalog";
import {
  employeeIdentityOnly,
  employeeIdentityError,
  isEmployeeIdentityField,
} from "@/domain/employee-identity";
import { intentName, optionName, serviceGroupName } from "@/domain/presentation";
import { extractIntake } from "@/domain/text";
import { missingFacts } from "@/domain/policy";
import type { DurationProposal } from "@/domain/access-defaults";
import {
  requestKinds,
  serviceGroups,
  type CanonicalRequest,
  type Decision,
  type SupportInput,
  type SupportRequest,
  type ServiceGroup,
  type RequestKind,
  type Assistance,
} from "@/domain/contracts";
import { browserApi } from "@/lib/browser-api";
import { Alert, Button, Card, Spinner, Textarea } from "@/components/ui";
import { SupportResult } from "@/components/support-result";
import { SupportField } from "@/components/support-field";
import { AssistanceHistory } from "@/components/support-history";
import { AiPending, ContentSkeleton } from "@/components/loading-feedback";
import { localized, localizedError, useLocale } from "@/i18n/locale";
type Preview = {
  durationProposal?: DurationProposal | null;
  input: SupportInput;
  canonical: CanonicalRequest;
  decision: Decision;
  assistance: Assistance | null;
};
const kinds: Record<RequestKind, [string, string]> = {
  GUIDANCE: ["Hỏi cách thực hiện", "How-to guidance"],
  SAFE_DIAGNOSTIC: ["Tìm nguyên nhân lỗi", "Troubleshoot an issue"],
  ROUTINE_WORKFLOW: ["Yêu cầu thông thường", "Routine request"],
  ACCESS_REQUEST: ["Xin quyền truy cập", "Access request"],
  CONFIGURATION_CHANGE: ["Thay đổi cấu hình", "Configuration change"],
  INCIDENT: ["Báo sự cố", "Report an incident"],
  OTHER: ["Tôi chưa rõ", "Not sure"],
};
const familiar: ServiceGroup[] = [
  "DEVICE_BOOT",
  "NETWORK_VPN",
  "ACCOUNT_ACCESS",
  "SOFTWARE_LICENSE",
];
export function SupportWorkspace() {
  const { locale } = useLocale();
  const router = useRouter();
  const [account, setAccount] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void identityApi<{ status: "ACTIVE" | "PENDING" | "ADMIN"; id?: string; department?: string }>("session").then((session) => {
      if (active && session.status === "ACTIVE" && session.id) {
        setAccount({ id: session.id });
        setInput((current) => ({ ...current, fields: { ...current.fields, employeeId: session.id!, ...(session.department ? { department: session.department } : {}) } }));
      } else if (active) {
        router.replace("/login?next=%2Fsend-help");
      }
    }).catch(() => {
      if (active) router.replace("/login?next=%2Fsend-help");
    }).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => { active = false; };
  }, [router]);
  const [input, setInput] = useState<SupportInput>({
    mode: "freeform",
    serviceGroup: "OTHER",
    rawText: "",
    fields: {},
    confirmed: false,
    idempotencyKey: "",
  });
  const [preview, setPreview] = useState<Preview | null>(null),
    [trackingProof, setTrackingProof] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function edit(next: Partial<SupportInput>) {
    setInput((current) => ({ ...current, ...next, previewId: undefined }));
    setPreview(null);
    setTrackingProof("");
    setError("");
  }
  async function analyze() {
    if (busy) return;
    const identityError = employeeIdentityError(input.fields);
    if (identityError) {
      setError(localizedError(new Error(identityError), locale, identityError, "Enter a valid employee ID and complete the required fields."));
      return;
    }
    if (
      !input.rawText.trim() &&
      !Object.entries(input.fields).some(
        ([field, value]) => !isEmployeeIdentityField(field) && value.trim(),
      )
    ) {
      setError(localized("Nhập mô tả yêu cầu hoặc chọn một nhu cầu cụ thể trong danh mục.", "Describe your request or choose a specific need from the list.", locale));
      return;
    }
    setBusy(true);
    setError("");
    const idempotencyKey = crypto.randomUUID();
    const trackingProof = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    try {
      const value = await browserApi<Preview>("/api/support/preview", {
        ...input,
        previewId: undefined,
        idempotencyKey,
      });
      setInput(value.input);
      setPreview(value);
      setTrackingProof(trackingProof);
    } catch (error) {
      setError(localizedError(error, locale, "Chưa thể kiểm tra thông tin. Thử lại.", "We couldn't review the request. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!preview || busy) return;
    if (!trackingProof) {
      setError(localized("Không thể xác nhận biên nhận cho yêu cầu này. Hãy tải lại preview trước khi gửi.", "The request receipt could not be confirmed. Reload the preview before submitting.", locale));
      return;
    }
    setBusy(true);
    setError("");
    try {
      rememberPendingGuestRequest(preview.input.idempotencyKey, trackingProof);
      const receipt = await browserApi<SupportRequest & { trackingToken: string }>("/api/support/requests", {
        ...preview.input,
        confirmed: true,
      }, { "x-tracking-proof": trackingProof });
      removePendingGuestRequest(preview.input.idempotencyKey);
      router.push(`/requests/${receipt.id}#token=${receipt.trackingToken}`);
    } catch (error) {
      setError(localizedError(error, locale, "Chưa gửi được. Nội dung của bạn vẫn được giữ lại.", "The request was not submitted. Your content is still available."));
      setBusy(false);
    }
  }
  const isConversation = !!preview?.assistance?.answer;
  const required = missingFacts(
    extractIntake({
      ...input,
      rawText: "",
      fields: { intentLabel: input.fields.intentLabel ?? "" },
    }),
  ).filter(
    (field) => allFields.has(field) && field !== "resetType" && !isEmployeeIdentityField(field),
  );
  const initialFields = required.slice(0, 3);
  const extraFields = [
    ...new Set([
      ...required,
      ...commonFields,
      ...catalog[input.serviceGroup].fields,
    ]),
  ].filter(
    (field) => !initialFields.includes(field) && !isEmployeeIdentityField(field),
  );
  function fieldControl(field: string) {
    return (
      <SupportField
        key={field}
        field={field}
        value={input.fields[field] ?? ""}
        onChange={(value) =>
          edit({ fields: { ...input.fields, [field]: value } })
        }
      />
    );
  }
  if (authLoading || !account) return <main className="page page-narrow"><ContentSkeleton label="Đang kiểm tra phiên đăng nhập…" labelEn="Checking your sign-in session…" /></main>;
  return (
    <main className="page page-narrow page-enter" data-guide-stage={preview ? "sender-preview" : "sender-form"}>
      <h1>{localized("Tôi cần hỗ trợ", "How can we help?", locale)}</h1>
      {account && <Alert>{localized("Tài khoản nhân viên đang hoạt động · ID", "Employee account active · ID", locale)} {account.id}. <button type="button" className="identity-text-link" onClick={async () => { try { await identityApi("logout", {}); window.location.assign("/"); } catch (cause) { setError(localizedError(cause, locale, "Không thể đăng xuất. Hãy thử lại.", "Could not sign out. Please try again.")); } }}>{localized("Đăng xuất", "Sign out", locale)}</button></Alert>}
      <p className="page-description">
        {localized("Bạn cứ mô tả vấn đề bằng lời của mình. Chúng tôi sẽ giúp bạn tìm hướng xử lý phù hợp.", "Describe the issue in your own words. We’ll help you find an appropriate next step.", locale)}
      </p>
      <ol className="flow-steps" aria-label={localized("Các bước gửi yêu cầu", "Request steps", locale)}>
        <li aria-current={!preview ? "step" : undefined}>{localized("1. Mô tả", "1. Describe", locale)}</li>
        <li aria-current={preview ? "step" : undefined}>
          {localized("2. Kiểm tra thông tin", "2. Review", locale)}
        </li>
        <li>{localized("3. Nhận hỗ trợ", "3. Get support", locale)}</li>
      </ol>
      <Card>
        <div className="support-actions" role="group" aria-label={localized("Kiểu yêu cầu", "Request type", locale)} data-guide="sender-mode">
          {(["freeform", "structured"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={input.mode === mode ? "primary" : "secondary"}
              aria-pressed={input.mode === mode}
              disabled={busy || !!preview}
              onClick={() => {
                if (mode !== input.mode)
                  edit({
                    mode,
                    fields: employeeIdentityOnly(input.fields),
                    requestKind: undefined,
                  });
              }}
            >
              {mode === "freeform" ? localized("Mô tả vấn đề", "Describe the issue", locale) : localized("Chọn theo danh mục", "Choose a category", locale)}
            </Button>
          ))}
        </div>
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void (preview ? submit() : analyze());
          }}
        >
          <fieldset
            disabled={busy || !!preview}
            className="intake-fields space-y-5"
            hidden={!!preview}
          >
            <label>
              {localized("Phòng ban", "Department", locale)}
              <select
                aria-label={localized("Phòng ban", "Department", locale)}
                data-guide="sender-department"
                value={input.fields.department ?? ""}
                onChange={(event) => edit({ fields: { ...input.fields, department: event.target.value } })}
                required
              >
                <option value="">{localized("Chọn phòng ban", "Select a department", locale)}</option>
                {fieldOptions.department.map((department) => (
                  <option key={department} value={department}>{optionName(department, locale)}</option>
                ))}
              </select>
              <span className="field-hint">{localized("Bắt buộc trước khi gửi yêu cầu.", "Required before submitting a request.", locale)}</span>
            </label>
            <label>
              {localized("Nhóm hỗ trợ", "Support area", locale)}
              <select
                aria-label={localized("Nhóm hỗ trợ", "Support area", locale)}
                data-guide="sender-group"
                value={input.serviceGroup}
                onChange={(event) =>
                  edit({
                    serviceGroup: event.target.value as ServiceGroup,
                    fields: employeeIdentityOnly(input.fields),
                    requestKind: undefined,
                  })
                }
              >
                <option value="OTHER">{localized("Tôi chưa biết nhóm nào", "I'm not sure which area", locale)}</option>
                <optgroup label={localized("Công việc & dịch vụ nhân viên", "Employee services", locale)}>
                  {companyServiceGroups.map(group => <option key={group} value={group}>{serviceGroupName(group, locale)}</option>)}
                </optgroup>
                <optgroup label={localized("Vấn đề thường gặp", "Common issues", locale)}>
                  {familiar.map((group) => (
                    <option key={group} value={group}>
                      {serviceGroupName(group, locale)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={localized("Công nghệ chuyên sâu", "Advanced technology", locale)}>
                  {serviceGroups
                    .filter(
                      (group) => group !== "OTHER" && !familiar.includes(group) && !isCompanyService(group),
                    )
                    .map((group) => (
                      <option key={group} value={group}>
                        {serviceGroupName(group, locale)}
                      </option>
                    ))}
                </optgroup>
              </select>
              <span className="field-hint">
                {localized("Không bắt buộc. Hệ thống sẽ giúp bạn xác định nhóm phù hợp.", "Optional. The system can help identify the right area.", locale)}
              </span>
            </label>
            {input.mode === "structured" && (
              <>
                <label>
                  {localized("Nhu cầu cụ thể", "Specific need", locale)}
                  <select
                    aria-label={localized("Nhu cầu cụ thể", "Specific need", locale)}
                    data-guide="sender-intent"
                    value={input.fields.intentLabel ?? ""}
                    onChange={(event) =>
                      edit({
                        fields: {
                          ...employeeIdentityOnly(input.fields),
                          intentLabel: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">{localized("Chọn nhu cầu", "Select a need", locale)}</option>
                    {catalog[input.serviceGroup].labels.map((label) => (
                      <option key={label} value={label}>
                        {intentName(label, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {input.fields.intentLabel && (
                  <div className="grid gap-4 sm:grid-cols-2" data-guide="sender-fields">
                    {initialFields.map(fieldControl)}
                  </div>
                )}
                <details>
                  <summary>{localized("Thông tin khác bạn đã biết (không bắt buộc)", "Other details you know (optional)", locale)}</summary>
                  <label>
                    {localized("Loại yêu cầu", "Request type", locale)}
                    <select
                      aria-label={localized("Loại yêu cầu", "Request type", locale)}
                      value={input.requestKind ?? ""}
                      onChange={(event) =>
                        edit({
                          requestKind:
                            (event.target.value as RequestKind) || undefined,
                        })
                      }
                    >
                      <option value="">{localized("Để hệ thống nhận diện", "Let the system identify it", locale)}</option>
                      {requestKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {localized(kinds[kind][0], kinds[kind][1], locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {extraFields.map(fieldControl)}
                  </div>
                </details>
              </>
            )}
            <label>
              {localized("Mô tả yêu cầu", "Request description", locale)}{" "}
              {input.mode === "structured" ? localized("(không bắt buộc)", "(optional)", locale) : ""}
              <Textarea
                aria-label={localized("Mô tả yêu cầu", "Request description", locale)}
                data-guide="sender-description"
                rows={5}
                required={input.mode === "freeform"}
                maxLength={6000}
                value={input.rawText}
                onChange={(event) => edit({ rawText: event.target.value })}
                placeholder={localized("Ví dụ: VPN không kết nối, tôi nên kiểm tra gì?", "For example: My VPN won't connect. What should I check?", locale)}
              />
              <span className="field-hint">
                {localized("Nêu điều bạn muốn làm và lỗi đang gặp. Không gửi mật khẩu hoặc mã xác minh.", "Describe what you are trying to do and the issue. Do not include passwords or verification codes.", locale)}
              </span>
            </label>
            {incidentTopic(input.rawText) && <label>{localized("Khu vực sự cố (để nhận cập nhật chung)", "Incident location (for shared updates)", locale)}
              <input aria-label={localized("Khu vực sự cố", "Incident location", locale)} value={input.fields.incidentSite || ""} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" placeholder={localized("Mã khu vực, ví dụ DEMO-HQ", "Location code, e.g. DEMO-HQ", locale)} onChange={event => edit({ fields: { ...input.fields, incidentSite: event.target.value } })} />
              <span className="field-hint">{localized("Dùng cùng mã khu vực với đồng nghiệp. Bỏ trống nếu chưa biết, yêu cầu vẫn được tiếp nhận riêng. Không nhập tên người hoặc địa chỉ.", "Use the same location code as colleagues. Leave blank if unknown, your request is still handled separately. Do not enter a person's name or address.", locale)}</span>
            </label>}
          </fieldset>
          {error && <Alert tone="error">{error}</Alert>}
          {busy && !preview && <AiPending />}
          {preview && (
            <section className="support-preview" aria-label={localized("Kiểm tra dữ kiện", "Review request details", locale)}>
              <p className="eyebrow">
                {isConversation
                  ? localized("TRỢ LÝ TRẢ LỜI TRỰC TIẾP", "DIRECT ASSISTANT RESPONSE", locale)
                  : localized("CHƯA GỬI YÊU CẦU", "REQUEST NOT SUBMITTED", locale)}
              </p>
              <h2 data-guide="sender-preview">
                {isConversation ? localized("Câu hỏi của bạn", "Your question", locale) : localized("Mình đã hiểu như sau", "Here is what I understood", locale)}
              </h2>
              <p>
                {!isConversation && (
                  <>
                    {serviceGroupName(preview.canonical.serviceGroup, locale)} ·{" "}
                    {intentName(preview.canonical.intentLabel, locale)}
                  </>
                )}
              </p>
              <blockquote className="original-question">
                {preview.input.rawText || localized("Yêu cầu theo danh mục", "Categorized request", locale)}
              </blockquote>
              <dl className="fact-list">
                {Object.entries(preview.canonical.entities)
                  .filter(([key]) => key !== "intentLabel")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{labelForField(key, locale)}</dt>
                      <dd>{optionName(value, locale)}</dd>
                    </div>
                  ))}
              </dl>
              <p>
                {isConversation
                  ? localized("Bạn đã nhận câu trả lời. Lưu cuộc trò chuyện để mở khung Hỏi tiếp ngay bên dưới phản hồi và tiếp tục theo ngữ cảnh.", "You have received an answer. Save the conversation to ask a follow-up below and continue with this context.", locale)
                  : localized("Bản xem trước chưa tạo hồ sơ. Kiểm tra thông tin rồi xác nhận gửi bên dưới.", "The preview has not created a request. Check the details, then confirm submission below.", locale)}
              </p>
              {!isConversation && <SupportResult {...preview} />}
              {preview.durationProposal && <div className="identity-card" role="group" aria-label={localized("Thời hạn đề xuất", "Proposed duration", locale)}>
                <p>{preview.durationProposal.label}</p>
                <p>{localized("Chỉ áp dụng cho quyền thông thường. Đây chưa phải quyết định cấp quyền và không tự gia hạn.", "Applies to standard access only. This is not an access decision and does not renew automatically.", locale)}</p>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => edit({
                  fields: { ...input.fields, duration: preview.durationProposal!.value }, confirmed: false,
                })}>{localized(`Dùng ${preview.durationProposal.hours} giờ và kiểm tra lại`, `Use ${preview.durationProposal.hours} hours and review again`, locale)}</Button>
              </div>}
              {preview.assistance && (
                <AssistanceHistory items={[preview.assistance]} />
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => edit({ confirmed: false })}
              >
                {isConversation ? localized("Hỏi câu khác", "Ask another question", locale) : localized("Quay lại sửa", "Go back and edit", locale)}
              </Button>
            </section>
          )}
          <Button type="submit" disabled={busy} data-guide={preview ? "sender-confirm" : "sender-send"}>
            {busy ? (
              <>
                <Spinner />
                {localized("Đang xử lý…", "Processing…", locale)}
              </>
            ) : preview ? (
              isConversation ? (
                localized("Lưu và tiếp tục trò chuyện", "Save and continue the conversation", locale)
              ) : (
                localized("Xác nhận và gửi yêu cầu", "Confirm and submit request", locale)
              )
            ) : (
              localized("Gửi", "Submit", locale)
            )}
          </Button>
        </form>
      </Card>
    </main>
  );
}
