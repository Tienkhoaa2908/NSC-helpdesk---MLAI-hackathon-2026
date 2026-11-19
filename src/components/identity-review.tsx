"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { identityApi, IdentityApiError } from "./identity-ui";
import { Alert, Button } from "./ui";
import { StaffWorkspace } from "./staff-workspace";
import { localized, useLocale } from "@/i18n/locale";

type AccountRequest = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "PROCESSING" | "ISSUED" | "REJECTED" | "DELIVERY_FAILED" | "REJECTION_DELIVERY_FAILED" | "ADMIN_NOTICE_FAILED";
  retryAction: "ADMIN_NOTICE" | "APPROVE" | "REJECT" | null;
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: AccountRequest["status"], locale: "vi" | "en") {
  const labels = {
    PENDING: ["Chờ Admin xử lý", "Pending Admin review"],
    PROCESSING: ["Đang xử lý email", "Processing email"],
    ISSUED: ["Đã gửi tài khoản", "Account issued"],
    REJECTED: ["Đã từ chối", "Request rejected"],
    DELIVERY_FAILED: ["Chưa xác nhận email thông tin đăng nhập", "Credential email status unconfirmed"],
    REJECTION_DELIVERY_FAILED: ["Chưa xác nhận email từ chối", "Rejection email status unconfirmed"],
    ADMIN_NOTICE_FAILED: ["Chưa xác nhận email thông báo Admin", "Admin notice status unconfirmed"],
  } as const;
  return localized(labels[status][0], labels[status][1], locale);
}

export function IdentityReview() {
  const { locale } = useLocale();
  const [rows, setRows] = useState<AccountRequest[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextStatus: "pending" | "all", nextPage = 1) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await identityApi<{ items: AccountRequest[]; hasMore: boolean }>(`review?status=${nextStatus}&page=${nextPage}`);
      setRows(result.items);
      setStatus(nextStatus);
      setPage(nextPage);
      setHasMore(result.hasMore);
      setNeedsAdmin(false);
      return true;
    } catch (cause) {
      setRows([]);
      setHasMore(false);
      setNeedsAdmin(cause instanceof IdentityApiError && (cause.status === 401 || cause.status === 403));
      setError(cause instanceof Error ? cause.message : localized("Không tải được danh sách yêu cầu.", "Could not load account requests.", locale));
      return false;
    } finally {
      setBusy(false);
    }
  }, [locale]);

  async function decide(row: AccountRequest, decision: "APPROVE" | "REJECT") {
    const retrying = row.retryAction === decision;
    const prompt = decision === "APPROVE"
      ? retrying
        ? localized("Gửi lại cùng thông tin đăng nhập tới " + row.email + "?", "Resend the same sign-in details to " + row.email + "?", locale)
        : localized("Cấp tài khoản và gửi thông tin đăng nhập tới " + row.email + "?", "Issue an account and email sign-in details to " + row.email + "?", locale)
      : retrying
        ? localized("Gửi lại email từ chối cho " + row.email + "?", "Resend the rejection notice to " + row.email + "?", locale)
        : localized("Từ chối yêu cầu của " + row.fullName + " và gửi email thông báo?", "Reject " + row.fullName + "'s request and email the decision?", locale);
    if (!window.confirm(prompt)) return;
    setWorkingId(row.id);
    setError("");
    setNotice("");
    try {
      await identityApi<{ status: "APPROVED" | "REJECTED" }>("review/decision", { id: row.id, decision });
      await load(status, page);
      setNotice(decision === "APPROVE"
        ? localized("Đã cấp tài khoản, máy chủ email đã nhận thông tin đăng nhập.", "The account is active and the email server accepted the sign-in details.", locale)
        : localized("Đã từ chối yêu cầu, máy chủ email đã nhận thông báo.", "The request was rejected and the email server accepted the notice.", locale));
    } catch (cause) {
      if (await load(status, page)) setError(cause instanceof Error ? cause.message : localized("Không thể xử lý yêu cầu.", "Could not process the request.", locale));
    } finally {
      setWorkingId("");
    }
  }

  async function retryAdminNotice(row: AccountRequest) {
    setWorkingId(row.id);
    setError("");
    setNotice("");
    try {
      await identityApi<{ status: "SENT" }>("review/notification", { id: row.id });
      await load(status, page);
      setNotice(localized("Máy chủ email đã nhận thông báo Admin. Hộp thư chưa được kiểm tra.", "The email server accepted the Admin notice. Inbox receipt was not checked.", locale));
    } catch (cause) {
      if (await load(status, page)) setError(cause instanceof Error ? cause.message : localized("Không thể gửi lại thông báo.", "Could not resend the notice.", locale));
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
            <p>{localized("Danh sách chỉ dành cho Admin. Email thông báo mở danh sách riêng. Để xác nhận hoặc từ chối, hãy đăng nhập Admin rồi bấm nút tương ứng.", "This list is private to the Admin. The notification email opens it. An Admin must sign in and choose an explicit action to approve or reject a request.", locale)}</p>
          </div>
          <Button variant="secondary" disabled={busy || Boolean(workingId)} onClick={() => void load(status, page)}>
            {busy ? localized("Đang tải…", "Loading…", locale) : localized("Tải lại danh sách", "Refresh", locale)}
          </Button>
        </header>

        <Alert>{localized("Liên kết trong email chỉ mở danh sách. Chỉ thao tác xác nhận hoặc từ chối tại màn hình này mới xử lý yêu cầu.", "The email link only opens the list. The request changes only after an explicit approval or rejection here.", locale)}</Alert>

        {error && <Alert tone="error">{error} {needsAdmin && <Link className="identity-text-link" href="/login?next=%2Fidentity%2Freview">{localized("Đăng nhập bằng ID quản trị", "Sign in with the admin ID", locale)}</Link>}</Alert>}
        {notice && <Alert>{notice}</Alert>}

        {!needsAdmin && <>
          <label className="identity-filter">
            {localized("Trạng thái", "Status", locale)}
            <select aria-label={localized("Lọc yêu cầu", "Filter requests", locale)} value={status} disabled={busy || Boolean(workingId)} onChange={(event) => void load(event.target.value as "pending" | "all")}>
              <option value="pending">{localized("Chờ xử lý", "Pending", locale)}</option>
              <option value="all">{localized("Tất cả", "All", locale)}</option>
            </select>
          </label>
          <p role="status">{busy ? localized("Đang tải yêu cầu…", "Loading requests…", locale) : localized(`${rows.length} yêu cầu`, `${rows.length} requests`, locale)}</p>
          {!busy && !error && rows.length === 0 && <p>{localized("Chưa có yêu cầu trong mục này.", "There are no requests in this view.", locale)}</p>}
          <div className="identity-request-list">
            {rows.map((row) => (
              <article className="identity-card" key={row.id}>
                <div className="identity-review-heading">
                  <h2>{row.fullName}</h2>
                  <span className="eyebrow">{statusLabel(row.status, locale)}</span>
                </div>
                <p><strong>{localized("Email / ID dự kiến", "Email / requested ID", locale)}:</strong> <a href={"mailto:" + row.email}>{row.email}</a></p>
                <p><strong>{localized("Ngày gửi", "Submitted", locale)}:</strong> <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time></p>
                {row.status !== "PROCESSING" && row.retryAction === "ADMIN_NOTICE" && (
                  <div className="identity-actions">
                    <Button disabled={Boolean(workingId) || busy} onClick={() => void retryAdminNotice(row)}>
                      {workingId === row.id ? localized("Đang xử lý…", "Processing…", locale) : localized("Gửi lại email thông báo Admin", "Retry Admin notice", locale)}
                    </Button>
                  </div>
                )}
                {row.status !== "PROCESSING" && (row.status === "PENDING" || row.status === "ADMIN_NOTICE_FAILED") && (
                  <div className="identity-actions">
                    <Button disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "APPROVE")}>
                      {workingId === row.id ? localized("Đang xử lý…", "Processing…", locale) : localized("Xác nhận cấp tài khoản", "Approve and issue", locale)}
                    </Button>
                    <Button variant="secondary" disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "REJECT")}>
                      {localized("Từ chối yêu cầu", "Reject request", locale)}
                    </Button>
                  </div>
                )}
                {row.status !== "PROCESSING" && row.retryAction === "APPROVE" && (
                  <div className="identity-actions">
                    <Button disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "APPROVE")}>
                      {workingId === row.id ? localized("Đang xử lý…", "Processing…", locale) : localized("Gửi lại cùng mật khẩu", "Retry same credential", locale)}
                    </Button>
                  </div>
                )}
                {row.status !== "PROCESSING" && row.retryAction === "REJECT" && (
                  <div className="identity-actions">
                    <Button variant="secondary" disabled={Boolean(workingId) || busy} onClick={() => void decide(row, "REJECT")}>
                      {workingId === row.id ? localized("Đang xử lý…", "Processing…", locale) : localized("Gửi lại email từ chối", "Retry rejection notice", locale)}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {(hasMore || page > 1) && <nav className="identity-actions" aria-label={localized("Phân trang yêu cầu", "Request pages", locale)}>
            <Button variant="secondary" disabled={page <= 1 || busy || Boolean(workingId)} onClick={() => void load(status, page - 1)}>{localized("Trang trước", "Previous page", locale)}</Button>
            <span>{localized(`Trang ${page}`, `Page ${page}`, locale)}</span>
            <Button variant="secondary" disabled={!hasMore || busy || Boolean(workingId)} onClick={() => void load(status, page + 1)}>{localized("Trang sau", "Next page", locale)}</Button>
          </nav>}
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
