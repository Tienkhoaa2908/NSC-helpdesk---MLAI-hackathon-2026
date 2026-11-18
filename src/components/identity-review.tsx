"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { identityApi } from "./identity-ui";
import { Alert, Button } from "./ui";
import { StaffWorkspace } from "./staff-workspace";
import { localized, useLocale } from "@/i18n/locale";

type AccountRequest = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "ISSUED" | "REJECTED" | "DELIVERY_FAILED" | "REJECTION_DELIVERY_FAILED";
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: AccountRequest["status"], locale: "vi" | "en") {
  const labels = {
    PENDING: ["Chờ Admin xử lý", "Pending Admin review"],
    ISSUED: ["Đã gửi tài khoản", "Account issued"],
    REJECTED: ["Đã từ chối", "Request rejected"],
    DELIVERY_FAILED: ["Gửi thông tin đăng nhập thất bại", "Credential delivery failed"],
    REJECTION_DELIVERY_FAILED: ["Gửi email từ chối thất bại", "Rejection email delivery failed"],
  } as const;
  return localized(labels[status][0], labels[status][1], locale);
}

export function IdentityReview() {
  const { locale } = useLocale();
  const [rows, setRows] = useState<AccountRequest[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextStatus: "pending" | "all") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await identityApi<{ items: AccountRequest[]; hasMore: boolean }>(`review?status=${nextStatus}`);
      setRows(result.items);
      setStatus(nextStatus);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : localized("Không tải được danh sách yêu cầu.", "Could not load account requests.", locale));
    } finally {
      setBusy(false);
    }
  }, [locale]);

  async function decide(row: AccountRequest, decision: "APPROVE" | "REJECT") {
    const prompt = decision === "APPROVE"
      ? localized("Cấp tài khoản và gửi thông tin đăng nhập tới " + row.email + "?", "Issue an account and email sign-in details to " + row.email + "?", locale)
      : localized("Từ chối yêu cầu của " + row.fullName + " và gửi email thông báo?", "Reject " + row.fullName + "'s request and email the decision?", locale);
    if (!window.confirm(prompt)) return;
    setWorkingId(row.id);
    setError("");
    setNotice("");
    try {
      await identityApi<{ status: "APPROVED" | "REJECTED" }>("review/decision", { id: row.id, decision });
      await load(status);
      setNotice(decision === "APPROVE"
        ? localized("Đã cấp tài khoản và gửi thông tin đăng nhập.", "Account issued and sign-in details sent.", locale)
        : localized("Đã từ chối yêu cầu và gửi email thông báo.", "Request rejected and notice sent.", locale));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : localized("Không thể xử lý yêu cầu.", "Could not process the request.", locale));
    } finally {
      setWorkingId("");
    }
  }

  useEffect(() => { void load("pending"); }, [load]);

  return (
    <StaffWorkspace active="identity">
      <main className="identity-review">
        <header className="identity-review-heading">
          <div>
            <span className="eyebrow">{localized("QUẢN TRỊ TÀI KHOẢN", "ACCOUNT ADMIN", locale)}</span>
            <h1>{localized("Yêu cầu cấp tài khoản", "Account requests", locale)}</h1>
            <p>{localized("Danh sách chỉ dành cho Admin. Mở email thông báo sẽ đưa bạn tới đây; thao tác xác nhận hoặc từ chối cần đăng nhập Admin và bấm nút tương ứng.", "This list is private to the Admin. The notification email opens this page; approving or rejecting requires an Admin sign-in and an explicit action.", locale)}</p>
          </div>
          <Button variant="secondary" disabled={busy} onClick={() => void load(status)}>
            {busy ? localized("Đang tải…", "Loading…", locale) : localized("Tải lại danh sách", "Refresh", locale)}
          </Button>
        </header>

        <Alert>{localized("Liên kết trong email chỉ mở danh sách. Chỉ thao tác xác nhận hoặc từ chối tại màn hình này mới xử lý yêu cầu.", "The email link only opens the list. The request changes only after an explicit approval or rejection here.", locale)}</Alert>

        {error && <Alert tone="error">{error} <Link className="identity-text-link" href="/login?next=%2Fidentity%2Freview">{localized("Đăng nhập bằng ID quản trị", "Sign in with the admin ID", locale)}</Link></Alert>}
        {notice && <Alert>{notice}</Alert>}

        {!error && <>
          <label className="identity-filter">
            {localized("Trạng thái", "Status", locale)}
            <select aria-label={localized("Lọc yêu cầu", "Filter requests", locale)} value={status} disabled={busy} onChange={(event) => void load(event.target.value as "pending" | "all")}>
              <option value="pending">{localized("Chờ xử lý", "Pending", locale)}</option>
              <option value="all">{localized("Tất cả", "All", locale)}</option>
            </select>
          </label>
          <p role="status">{busy ? localized("Đang tải yêu cầu…", "Loading requests…", locale) : localized(`${rows.length} yêu cầu`, `${rows.length} requests`, locale)}</p>
          {!busy && rows.length === 0 && <p>{localized("Chưa có yêu cầu trong mục này.", "There are no requests in this view.", locale)}</p>}
          <div className="identity-request-list">
            {rows.map((row) => (
              <article className="identity-card" key={row.id}>
                <div className="identity-review-heading">
                  <h2>{row.fullName}</h2>
                  <span className="eyebrow">{statusLabel(row.status, locale)}</span>
                </div>
                <p><strong>{localized("Email / ID dự kiến", "Email / requested ID", locale)}:</strong> <a href={"mailto:" + row.email}>{row.email}</a></p>
                <p><strong>{localized("Ngày gửi", "Submitted", locale)}:</strong> <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time></p>
                {(row.status === "PENDING" || row.status === "DELIVERY_FAILED" || row.status === "REJECTION_DELIVERY_FAILED") && (
                  <div className="identity-actions">
                    <Button disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "APPROVE")}>
                      {workingId === row.id ? localized("Đang xử lý…", "Processing…", locale) : localized("Xác nhận cấp tài khoản", "Approve and issue", locale)}
                    </Button>
                    <Button variant="secondary" disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "REJECT")}>
                      {localized("Từ chối yêu cầu", "Reject request", locale)}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>}
      </main>
    </StaffWorkspace>
  );
}

export function IdentityAdminOnlyNotice() {
  const { locale } = useLocale();
  return (
    <StaffWorkspace active="identity">
      <main className="identity-review">
        <section className="identity-card" role="status">
          <span className="eyebrow">{localized("QUẢN TRỊ TÀI KHOẢN", "ACCOUNT ADMIN", locale)}</span>
          <h1>{localized("Phần này chỉ dành cho Admin", "Admin access only", locale)}</h1>
          <p>{localized("Danh sách yêu cầu cấp tài khoản và các thao tác duyệt chỉ hiển thị với tài khoản quản trị.", "Account requests and approval actions are available only to the system administrator.", locale)}</p>
          <Link className="button secondary" href="/">{localized("Về trang chính", "Back to home", locale)}</Link>
        </section>
      </main>
    </StaffWorkspace>
  );
}
