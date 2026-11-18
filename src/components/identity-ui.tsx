"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Button } from "./ui";
import { localized, useLocale } from "@/i18n/locale";

type IdentityResponse<T> = {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

const apiErrorCopy: Record<string, { vi: string; en: string }> = {
  AUTHENTICATION_REQUIRED: { vi: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.", en: "Your session has expired. Sign in again." },
  INVALID_CREDENTIALS: { vi: "ID hoặc mật khẩu không đúng.", en: "The ID or password is incorrect." },
  ACCOUNT_DISABLED: { vi: "Tài khoản đã bị vô hiệu hóa.", en: "This account has been disabled." },
  RATE_LIMITED: { vi: "Quá nhiều lần thử. Vui lòng chờ rồi thử lại.", en: "Too many attempts. Wait a moment and try again." },
  IDENTITY_STORAGE_UNAVAILABLE: { vi: "Cơ sở dữ liệu tài khoản chưa sẵn sàng. Vui lòng thử lại sau.", en: "The account database is unavailable. Try again later." },
  IDENTITY_EMAIL_NOT_CONFIGURED: { vi: "Email cấp tài khoản chưa được cấu hình. Liên hệ quản trị viên.", en: "Account email is not configured. Contact the administrator." },
  EMAIL_NOT_CONFIGURED: { vi: "Email cấp tài khoản chưa được cấu hình. Liên hệ quản trị viên.", en: "Account email is not configured. Contact the administrator." },
  ACCOUNT_REQUEST_EMAIL_FAILED: { vi: "Đơn đã được lưu nhưng chưa gửi được email cho quản trị viên. Hãy thử lại sau.", en: "Your request was saved, but the administrator notification could not be sent. Try again later." },
  EMAIL_DELIVERY_FAILED: { vi: "Chưa gửi được email. Đơn có thể đã được lưu; hãy thử gửi lại sau.", en: "The email could not be sent. Your request may have been saved; try again later." },
  ACCOUNT_ALREADY_ACTIVE: { vi: "Gmail này đã có tài khoản. Hãy đăng nhập bằng ID và mật khẩu.", en: "This Gmail address already has an account. Sign in with its ID and password." },
  ACCOUNT_REQUEST_EXISTS: { vi: "Email này đã có yêu cầu đang chờ xử lý.", en: "A request for this email is already pending." },
  ACCOUNT_REQUEST_PROCESSING: { vi: "Yêu cầu này đang được xử lý. Hãy thử lại sau.", en: "This request is being processed. Try again shortly." },
  ACCOUNT_REQUEST_CHANGED: { vi: "Yêu cầu đã thay đổi. Hãy gửi lại sau.", en: "The request changed. Please submit it again." },
  VALIDATION_ERROR: { vi: "Kiểm tra lại họ tên và địa chỉ Gmail.", en: "Check the name and Gmail address and try again." },
};

export async function identityApi<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
  const response = await fetch(`/api/identity/${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: body === undefined
      ? headers
      : { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({})) as IdentityResponse<T>;
  if (!response.ok || !result.success) {
    const locale = document.documentElement.lang === "en" ? "en" : "vi";
    const code = result.error?.code ?? "";
    const known = apiErrorCopy[code];
    throw new Error(known?.[locale] ?? (locale === "vi"
      ? result.error?.message ?? "Không thể hoàn tất yêu cầu. Vui lòng thử lại."
      : "The request could not be completed. Try again."));
  }
  return result.data as T;
}

export function LoginPanel() {
  const { locale } = useLocale();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const query = new URLSearchParams(window.location.search);
      const next = query.get("next") ?? undefined;
      const result = await identityApi<{ redirectTo: string }>("login", {
        employeeId: employeeId.trim(),
        password,
        ...(next ? { next } : {}),
      });
      window.location.assign(result.redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : localized("Đăng nhập không thành công. Thử lại.", "Sign-in failed. Try again.", locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="identity-login" aria-labelledby="login-title">
      <h1 id="login-title">{localized("Đăng nhập", "Sign in", locale)}</h1>
      <div className="identity-form">
        <p>{localized("Dùng ID nhân viên và mật khẩu đã được cấp để gửi yêu cầu hỗ trợ.", "Use your issued employee ID and password to submit a support request.", locale)}</p>
        {error && <Alert tone="error">{error}</Alert>}
        <form className="identity-form" onSubmit={(event) => void signIn(event)}>
          <label>
            {localized("ID nhân viên hoặc email", "Employee ID or email", locale)}
            <input
              required
              autoCapitalize="none"
              autoComplete="username"
              maxLength={254}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            />
          </label>
          <label>
            {localized("Mật khẩu", "Password", locale)}
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button disabled={busy}>{busy ? localized("Đang đăng nhập…", "Signing in…", locale) : localized("Đăng nhập", "Sign in", locale)}</Button>
        </form>
        <div className="identity-note demo-credentials" role="note">
          <strong>{localized("Tài khoản trải nghiệm", "Demo account", locale)}</strong>
          <p>{localized("ID", "ID", locale)}: <code>guest01</code></p>
          <p>{localized("Mật khẩu", "Password", locale)}: <code>12345</code></p>
          <small>{localized("Tài khoản này chỉ dùng để trải nghiệm dữ liệu mô phỏng.", "This account is for synthetic demo data only.", locale)}</small>
        </div>
        <Link className="identity-text-link" href="/identity/new">{localized("Nhân viên mới? Gửi yêu cầu cấp tài khoản", "New employee? Request an account", locale)}</Link>
        <details className="login-options">
          <summary>{localized("Hướng dẫn sử dụng", "User guide", locale)}</summary>
          <p>{localized("Nhập ID và mật khẩu được cấp. Nếu chưa có tài khoản, gửi yêu cầu bằng họ tên và Gmail; quản trị viên sẽ gửi thông tin đăng nhập sau khi xác nhận.", "Enter your issued ID and password. If you do not have an account, submit your name and Gmail address; the administrator will email your sign-in details after approval.", locale)}</p>
          <div className="identity-links">
            <Link href="/help/employee">{localized("Hướng dẫn nhân viên", "Employee guide", locale)}</Link>
            <Link href="/help">{localized("Trung tâm hướng dẫn", "Help center", locale)}</Link>
          </div>
        </details>
      </div>
    </section>
  );
}

export function NewIdentityApplication() {
  const { locale } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await identityApi<{ id: string; status: string }>("applications", {
        fullName: fullName.trim().replace(/\s+/g, " "),
        email: email.trim().toLowerCase(),
      });
      setSubmittedEmail(email.trim().toLowerCase());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : localized("Chưa gửi được yêu cầu. Thử lại.", "Could not submit the request. Try again.", locale));
    } finally {
      setBusy(false);
    }
  }

  if (submittedEmail) {
    return (
      <main className="identity-page">
        <section className="identity-card" aria-labelledby="application-sent-title">
          <span className="eyebrow">{localized("ĐÃ GỬI YÊU CẦU", "REQUEST SENT", locale)}</span>
          <h1 id="application-sent-title">{localized("Yêu cầu cấp tài khoản đã được gửi", "Your account request has been sent", locale)}</h1>
          <p>{localized(`Quản trị viên đã nhận yêu cầu cho ${submittedEmail}. Sau khi xác nhận, thông tin đăng nhập sẽ được gửi tới địa chỉ này.`, `The administrator has received the request for ${submittedEmail}. After approval, sign-in details will be sent to this address.`, locale)}</p>
          <div className="identity-note demo-credentials" role="note">
            <strong>{localized("Bạn có thể trải nghiệm ngay", "You can try the system now", locale)}</strong>
            <p>{localized("ID", "ID", locale)}: <code>guest01</code></p>
            <p>{localized("Mật khẩu", "Password", locale)}: <code>12345</code></p>
            <small>{localized("Tài khoản demo chỉ dùng dữ liệu mô phỏng.", "The demo account uses synthetic data only.", locale)}</small>
          </div>
          <div className="identity-actions">
            <Link className="button primary" href="/login">{localized("Đăng nhập demo", "Sign in to the demo", locale)}</Link>
            <Link className="button secondary" href="/">{localized("Về trang chính", "Back to home", locale)}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="identity-page">
      <section className="identity-card" aria-labelledby="application-title">
        <Link href="/login" className="identity-text-link">← {localized("Đăng nhập", "Sign in", locale)}</Link>
        <span className="eyebrow">{localized("DÀNH CHO NHÂN VIÊN MỚI", "NEW EMPLOYEE", locale)}</span>
        <h1 id="application-title">{localized("Yêu cầu cấp tài khoản", "Request an account", locale)}</h1>
        <p>{localized("Nhập họ tên và Gmail của bạn. Quản trị viên sẽ kiểm tra yêu cầu rồi gửi ID và mật khẩu qua email.", "Enter your name and Gmail address. The administrator will review your request and email your ID and password.", locale)}</p>
        <form className="identity-form" onSubmit={(event) => void submit(event)}>
          <label>
            {localized("Họ và tên", "Full name", locale)}
            <input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            Gmail
            <input required type="email" autoComplete="email" maxLength={254} pattern="[A-Za-z0-9._%+-]+@gmail\.com" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gmail.com" />
          </label>
          <p className="field-hint">{localized("Email này sẽ là ID nhân viên và địa chỉ nhận thông tin đăng nhập.", "This email address will be your employee ID and the destination for your sign-in details.", locale)}</p>
          {error && <Alert tone="error">{error}</Alert>}
          <Button disabled={busy}>{busy ? localized("Đang gửi yêu cầu…", "Sending request…", locale) : localized("Gửi yêu cầu cấp tài khoản", "Send account request", locale)}</Button>
        </form>
      </section>
    </main>
  );
}

export function IdentityTracking() {
  const { locale } = useLocale();
  return (
    <main className="identity-page">
      <section className="identity-card">
        <h1>{localized("Theo dõi yêu cầu cấp tài khoản", "Account request status", locale)}</h1>
        <p>{localized("Sau khi quản trị viên xác nhận, ID và mật khẩu sẽ được gửi tới Gmail bạn đã đăng ký.", "After the administrator approves your request, your ID and password will be sent to the Gmail address you registered.", locale)}</p>
        <Link className="button secondary" href="/identity/new">{localized("Gửi yêu cầu cấp tài khoản", "Request an account", locale)}</Link>
      </section>
    </main>
  );
}
