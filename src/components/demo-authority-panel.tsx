"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { demoProject, type Capacity, type DemoGrant, type DemoPool } from "@/domain/demo-authority";
import { identityApi } from "./identity-ui";
import { Alert, Button } from "./ui";
import { StaffWorkspace } from "./staff-workspace";
import { useLocale, localized, localizedError } from "@/i18n/locale";

type Snapshot = { pool: DemoPool | null; grants: DemoGrant[]; canManage: boolean; assurance: "demo" };
const labels: Record<keyof Capacity, string> = { cpu: "vCPU", ramGb: "GB RAM", diskGb: "GB disk", gpuT4: "GPU T4" };
const statuses = {
  PENDING: ["Chờ owner", "Awaiting owner"],
  APPROVED: ["Đã duyệt quyền demo", "Demo access approved"],
  REJECTED: ["Đã từ chối", "Rejected"],
  REVOKED: ["Đã thu hồi quyền demo", "Demo access revoked"],
} as const;
function numbers(data: FormData, prefix: string): Capacity {
  return { cpu: Number(data.get(`${prefix}cpu`)), ramGb: Number(data.get(`${prefix}ramGb`)),
    diskGb: Number(data.get(`${prefix}diskGb`)), gpuT4: Number(data.get(`${prefix}gpuT4`)) };
}
function CapacityFields({ prefix, title, titleEn, values }: { prefix: string; title: string; titleEn: string; values?: Capacity }) {
  const { locale } = useLocale();
  return <fieldset className="identity-form"><legend>{localized(title, titleEn, locale)}</legend>{(Object.keys(labels) as Array<keyof Capacity>).map((key) =>
    <label key={key}>{localized(title, titleEn, locale)} · {labels[key]}<input name={`${prefix}${key}`} type="number" min="0" max="1000000" step={key === "gpuT4" ? "1" : "any"} required defaultValue={values?.[key] ?? 0} /></label>)}</fieldset>;
}
export function DemoAuthorityPanel() {
  const { locale } = useLocale();
  const t = useCallback((vi: string, en: string) => localized(vi, en, locale), [locale]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState("");
  const load = useCallback(async () => { setSnapshot(await identityApi<Snapshot>("authority")); }, []);
  useEffect(() => { void load().catch(() => setError(t("Không tải được dữ liệu quyền demo.", "Could not load demo access data."))); }, [load, t]);
  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  async function mutate(route: string, body: unknown, success: [string, string]) {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try { await identityApi(`authority/${route}`, body); await load(); setNotice(t(success[0], success[1])); return true; }
    catch (cause) { setError(localizedError(cause, locale, "Chưa hoàn tất, thử lại cùng nội dung.", "Could not complete the action. Please retry with the same details.")); return false; }
    finally { setBusy(false); }
  }
  const pool = snapshot?.pool;
  return <StaffWorkspace active="identity"><main className="identity-review space-y-5">
    <div><span className="eyebrow">{t("QUYỀN VÀ HẠN MỨC DEMO", "DEMO ACCESS AND QUOTAS")}</span><h1>{demoProject}</h1>
      <p>{t("Sổ thử nghiệm cho VNG Support. Giữ nguyên quyết định policy của ticket hỗ trợ, không thực thi IAM hoặc cloud.", "A demo ledger for VNG Support. It does not change support policy decisions or execute IAM or cloud actions.")}</p>
      <Link href="/identity/review" className="identity-text-link">{t("Về trang cấp ID", "Back to employee IDs")}</Link>{" · "}<Link href="/workspace" className="identity-text-link">{t("Gửi yêu cầu hỗ trợ", "Submit a support request")}</Link>
    </div>
    <Alert>{t("Phiên đăng nhập đã được xác minh, IT đã duyệt profile và phạm vi cho phiên này. Entitlement, approval và số liệu quota ở đây chỉ là mô phỏng, không phải bằng chứng IAM/ITSM hoặc billing production. Ngân sách chưa cấu hình luôn cần Capacity owner.", "The signed-in session is verified and IT has approved its profile and scope. Entitlements, approvals, and quota figures here are simulated, they are not IAM, ITSM, or production billing evidence. Unconfigured budgets still require a capacity owner.")}</Alert>
    {error && <Alert tone="error">{error} <Link href="/login">{t("Đăng nhập lại", "Sign in again")}</Link></Alert>}
    {notice && <p role="status" className="identity-card">{notice}</p>}
    {!snapshot && !error && <p role="status">{t("Đang tải dữ liệu…", "Loading data…")}</p>}
    {snapshot && !pool && <Alert>{t("Sổ demo chưa được khởi tạo. Operator cần làm theo RUNBOOK, ứng dụng không tự tạo quyền hoặc mặc định usage bằng 0.", "The demo ledger has not been initialized. An operator must follow the RUNBOOK, the app does not create access or assume usage is zero.")}</Alert>}
    {pool && <>
      <section className="identity-card"><h2>{t("Hạn mức và dữ liệu quan sát", "Capacity limits and observed usage")}</h2>
        <p>{t(`Tối đa ${pool.maxHours} giờ mỗi lần cấp. GPU được tính riêng theo T4. Hết thời hạn không đồng nghĩa tài nguyên đã được giải phóng.`, `Maximum ${pool.maxHours} hours per grant. GPU capacity is measured separately in T4 units. Expiration does not confirm that resources were released.`)}</p>
        <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">{t("Quota theo project, gồm đang dùng và giữ chỗ", "Project quotas, including used and reserved capacity")}</caption><thead><tr><th>{t("Tài nguyên", "Resource")}</th><th>{t("Hạn mức", "Limit")}</th><th>{t("Đang dùng", "Used")}</th><th>{t("Đã giữ", "Reserved")}</th></tr></thead><tbody>
          {(Object.keys(labels) as Array<keyof Capacity>).map((key) => <tr key={key}><th>{labels[key]}</th><td>{pool.limits[key]}</td><td>{pool.used[key]}</td><td>{pool.reserved[key]}</td></tr>)}
        </tbody></table></div><p>{t("Quan sát:", "Observed:")} <time dateTime={pool.observedAt}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(pool.observedAt))}</time>. {t("Hiệu lực đến:", "Valid until:")} <time dateTime={pool.validUntil}>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(pool.validUntil))}</time>.</p>
        <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await load(); } catch { setSnapshot(null); setError(t("Không thể tải sổ demo.", "Could not load the demo ledger.")); } finally { setBusy(false); } }}>{t("Tải lại sổ demo", "Reload demo ledger")}</Button>
      </section>
      <form className="identity-card identity-form" onSubmit={async (event) => {
        event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
        const ok = await mutate("request", { id: requestId, scope: { target: demoProject, environment: "sandbox", resource: "cloud", operation: data.get("operation") }, hours: Number(data.get("hours")), reason: data.get("reason") }, ["Đã lưu đơn chờ owner. Chưa cấp quyền hoặc tài nguyên.", "Request saved for owner review. No access or resources were granted."]);
        if (ok) { setRequestId(crypto.randomUUID()); form.reset(); }
      }}><h2>{t("Xin quyền demo cho tài khoản đang đăng nhập", "Request demo access for the signed-in account")}</h2>
        <label>{t("Thao tác", "Operation")}<select name="operation"><option value="read">{t("Đọc tài nguyên sandbox", "Read sandbox resources")}</option><option value="create">{t("Tạo tài nguyên sandbox — vẫn kiểm tra quota/ngân sách", "Create sandbox resources — quota and budget checks still apply")}</option></select></label>
        <label>{t("Thời hạn (giờ, tối đa 24)", "Duration (hours, up to 24)")}<input name="hours" type="number" required min="0.01" max="24" step="any" /></label>
        <label>{t("Lý do", "Reason")}<textarea name="reason" required minLength={8} maxLength={500} /></label>
        <Button type="submit" disabled={busy || !requestId}>{t("Gửi đơn quyền demo", "Submit demo access request")}</Button>
      </form>
      <form className="identity-card identity-form" onSubmit={async (event) => {
        event.preventDefault(); if (busy) return; const data = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
        try { const result = await identityApi<{ entitlement: string; quota: { reason: string } }>("authority/check", { scope: { target: demoProject, environment: "sandbox", resource: "cloud", operation: "create" }, requested: numbers(data, "check-"), hours: Number(data.get("hours")) });
          setNotice(`${t("Quyền:", "Entitlement:")} ${result.entitlement === "demo-allowed" ? t("Khớp quyền demo còn hiệu lực", "Matches an active demo grant") : t("Chưa xác minh quyền phù hợp", "No matching grant verified")}. ${result.quota.reason} ${t("Không giữ chỗ hoặc cấp hạ tầng.", "No capacity is reserved or provisioned.")}`);
        } catch (cause) { setError(localizedError(cause, locale, "Không thể kiểm tra quyền và hạn mức.", "Could not check access and quota.")); } finally { setBusy(false); }
      }}><h2>{t("Kiểm tra yêu cầu tài nguyên", "Check a resource request")}</h2><CapacityFields prefix="check-" title="Xin thêm" titleEn="Requested" />
        <label>{t("Thời gian sử dụng (giờ)", "Requested duration (hours)")}<input name="hours" type="number" min="0.01" max="8760" step="any" required /></label>
        <Button type="submit" disabled={busy}>{t("Kiểm tra quyền và hạn mức demo", "Check demo access and quota")}</Button>
      </form>
      {snapshot.canManage && <details className="identity-card"><summary>{t("Cập nhật dung lượng và giữ chỗ — chỉ owner", "Update usage and reservations — owner only")}</summary>
        <form key={pool.version} className="identity-form" onSubmit={async (event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          await mutate("usage", { version: pool.version, used: numbers(data, "used-"), reserved: numbers(data, "reserved-"),
            observedAt: new Date(String(data.get("observedAt"))).toISOString(), validUntil: new Date(String(data.get("validUntil"))).toISOString(), reason: data.get("reason") }, ["Đã cập nhật snapshot quota demo và audit.", "Demo quota snapshot and audit updated."]);
        }}><CapacityFields prefix="used-" title="Đang dùng" titleEn="Used" values={pool.used} /><CapacityFields prefix="reserved-" title="Giữ chỗ" titleEn="Reserved" values={pool.reserved} />
          <label>{t("Thời điểm quan sát (giờ địa phương)", "Observation time (local) ")}<input type="datetime-local" name="observedAt" required /></label>
          <label>{t("Hiệu lực đến (giờ địa phương)", "Valid until (local)")}<input type="datetime-local" name="validUntil" required /></label>
          <label>{t("Căn cứ cập nhật", "Update reason")}<textarea name="reason" minLength={8} maxLength={500} required /></label>
          <Button type="submit" disabled={busy}>{t("Lưu snapshot và audit", "Save snapshot and audit")}</Button>
        </form>
      </details>}
      <section className="space-y-3"><h2>{snapshot.canManage ? t("Đơn quyền trong phạm vi quản lý", "Access requests in your scope") : t("Đơn quyền của bạn", "Your access requests")}</h2><p>{t("Hiển thị tối đa 100 đơn mới nhất. Không tự gia hạn. Duyệt quyền demo chưa đồng nghĩa với cấp tài nguyên.", "Showing up to 100 recent requests. Grants do not renew automatically. Approving demo access does not provision resources.")}</p>
        {!snapshot.grants.length && <p>{t("Chưa có đơn.", "No requests yet.")}</p>}
        {snapshot.grants.map((row) => <article key={`${row.id}:${row.version}`} className="identity-card"><h3>{localized(statuses[row.status][0], statuses[row.status][1], locale)} · {row.employeeId}</h3>
          <p>{row.scope.operation === "read" ? t("Đọc", "Read") : t("Tạo", "Create")} · {row.scope.target} · {t(`${row.hours} giờ`, `${row.hours} hours`)}</p><p>{row.reason}</p>
          <p>{t("Ngày gửi:", "Submitted:")} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.createdAt))}</p>
          {row.decisionReason && <p>{t("Lý do quyết định:", "Decision reason:")} {row.decisionReason}</p>}
          {row.expiresAt && <p>{t("Hết hiệu lực:", "Expires:")} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.expiresAt))}</p>}
          {snapshot.canManage && ["PENDING", "APPROVED"].includes(row.status) && <form className="identity-form" onSubmit={async (event) => {
            event.preventDefault(); const data = new FormData(event.currentTarget);
            await mutate("decision", { id: row.id, version: row.version, action: data.get("action"), reason: data.get("reason") }, ["Đã lưu quyết định và audit. Không thực thi tài nguyên, policy Support giữ nguyên.", "Decision and audit saved. No resources were provisioned, Support policy is unchanged."]);
          }}><label>{t("Quyết định", "Decision")}<select name="action">{row.status === "APPROVED" ? <option value="revoke">{t("Thu hồi quyền demo", "Revoke demo access")}</option> : <><option value="reject">{t("Từ chối", "Reject")}</option><option value="approve">{t("Duyệt quyền demo", "Approve demo access")}</option></>}</select></label>
            <label>{t("Lý do quyết định", "Decision reason")}<textarea name="reason" required minLength={8} maxLength={500} /></label><Button type="submit" disabled={busy}>{t("Lưu quyết định", "Save decision")}</Button><p>{t("Không thể xử lý đơn của chính mình.", "You cannot act on your own request.")}</p>
          </form>}
        </article>)}
      </section>
    </>}
  </main></StaffWorkspace>;
}
