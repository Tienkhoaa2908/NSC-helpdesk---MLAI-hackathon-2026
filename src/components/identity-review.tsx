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
  status: "PENDING" | "ISSUED" | "DELIVERY_FAILED";
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: AccountRequest["status"], locale: "vi" | "en") {
  const labels = {
    PENDING: ["Chờ xác nhận qua email", "Pending email confirmation"],
    ISSUED: ["Đã gửi tài khoản", "Account issued"],
    DELIVERY_FAILED: ["Gửi email thất bại", "Email delivery failed"],
  } as const;
  return localized(labels[status][0], labels[status][1], locale);
}

export function IdentityReview() {
  const { locale } = useLocale();
  const [rows, setRows] = useState<AccountRequest[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextStatus: "pending" | "all") => {
    setBusy(true);
    setError("");
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

  useEffect(() => { void load("pending"); }, [load]);

  return (
    <StaffWorkspace active="identity">
      <main className="identity-review">
        <header className="identity-review-heading">
          <div>
            <span className="eyebrow">{localized("QUẢN TRỊ TÀI KHOẢN", "ACCOUNT ADMIN", locale)}</span>
            <h1>{localized("Yêu cầu cấp tài khoản", "Account requests", locale)}</h1>
            <p>{localized("Danh sách này chỉ dành cho quản trị viên. Tài khoản được cấp qua liên kết xác nhận gửi tới email quản trị.", "This list is private to the administrator. Accounts are issued through the confirmation link sent by email.", locale)}</p>
          </div>
          <Button variant="secondary" disabled={busy} onClick={() => void load(status)}>
            {busy ? localized("Đang tải…", "Loading…", locale) : localized("Tải lại danh sách", "Refresh", locale)}
          </Button>
        </header>

        <Alert>{localized("Màn hình chỉ hiển thị yêu cầu; không có nút duyệt hoặc cấp tài khoản tại đây.", "This screen lists requests only. It does not approve requests or issue accounts.", locale)}</Alert>

        {error && <Alert tone="error">{error} <Link className="identity-text-link" href="/login?next=%2Fidentity%2Freview">{localized("Đăng nhập bằng ID quản trị", "Sign in with the admin ID", locale)}</Link></Alert>}

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
                <p><strong>{localized("Email / ID dự kiến", "Email / requested ID", locale)}:</strong> <a href={`mailto:${row.email}`}>{row.email}</a></p>
                <p><strong>{localized("Ngày gửi", "Submitted", locale)}:</strong> <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time></p>
              </article>
            ))}
          </div>
        </>}
      </main>
    </StaffWorkspace>
  );
}
