import { createTransport } from "nodemailer";
import { z } from "zod";
import { SupportError } from "./support-repository";

const emailSchema = z.string().trim().email().max(254);

function mailSettings() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "");
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = emailSchema.safeParse(process.env.SMTP_FROM?.trim() ?? "");
  const admin = emailSchema.safeParse(process.env.IDENTITY_ADMIN_EMAIL?.trim() ?? "");
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!host || ![465, 587].includes(port) || !user || !password || !from.success || !admin.success || !baseUrl)
    throw new SupportError("IDENTITY_EMAIL_NOT_CONFIGURED", "Chưa cấu hình dịch vụ email cấp tài khoản.", 503);
  let url: URL;
  try { url = new URL(baseUrl); }
  catch { throw new SupportError("IDENTITY_EMAIL_NOT_CONFIGURED", "Địa chỉ website cấp tài khoản chưa hợp lệ.", 503); }
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:")))
    throw new SupportError("IDENTITY_EMAIL_NOT_CONFIGURED", "Địa chỉ website cấp tài khoản chưa hợp lệ.", 503);
  return { host, port, user, password, from: from.data, admin: admin.data.toLowerCase(), baseUrl: url.origin };
}

function transporter() {
  const settings = mailSettings();
  return {
    settings,
    transport: createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      requireTLS: settings.port === 587,
      auth: { user: settings.user, pass: settings.password },
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 12000,
    }),
  };
}

export function assertIdentityEmailConfigured() {
  mailSettings();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

export async function sendAccountRequestNotice(input: { id: string; fullName: string; email: string; approvalToken: string }) {
  const { settings, transport } = transporter();
  const approvalUrl = new URL("/api/identity/approve", settings.baseUrl);
  approvalUrl.searchParams.set("token", input.approvalToken);
  const fullName = escapeHtml(input.fullName);
  const email = escapeHtml(input.email);
  await transport.sendMail({
    from: settings.from,
    to: settings.admin,
    subject: "Yêu cầu cấp tài khoản / Account request — NSClub Help Desk",
    text: `YÊU CẦU CẤP TÀI KHOẢN\n\nHọ tên: ${input.fullName}\nEmail / ID nhân viên: ${input.email}\nMã yêu cầu: ${input.id}\n\nXác nhận cấp tài khoản: ${approvalUrl.toString()}\nLiên kết chỉ dùng một lần và hết hạn sau một giờ.\n\nACCOUNT REQUEST\n\nName: ${input.fullName}\nEmail / employee ID: ${input.email}\nRequest ID: ${input.id}\n\nIssue the account: ${approvalUrl.toString()}\nThis link is single-use and expires in one hour.`,
    html: `<main><section lang="vi"><h1>Yêu cầu cấp tài khoản</h1><p><strong>Họ tên:</strong> ${fullName}</p><p><strong>Email / ID nhân viên:</strong> ${email}</p><p><strong>Mã yêu cầu:</strong> ${escapeHtml(input.id)}</p><p><a href="${escapeHtml(approvalUrl.toString())}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#f4511e;color:#111;font-weight:700;text-decoration:none">Xác nhận cấp tài khoản</a></p><p>Liên kết chỉ dùng một lần và hết hạn sau một giờ.</p></section><hr><section lang="en"><h1>Employee account request</h1><p><strong>Name:</strong> ${fullName}</p><p><strong>Email / employee ID:</strong> ${email}</p><p><strong>Request ID:</strong> ${escapeHtml(input.id)}</p><p><a href="${escapeHtml(approvalUrl.toString())}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#f4511e;color:#111;font-weight:700;text-decoration:none">Issue account</a></p><p>This link is single-use and expires in one hour.</p></section></main>`,
  });
}

export async function sendIssuedCredentials(input: { email: string; fullName: string; password: string }) {
  const { settings, transport } = transporter();
  const fullName = escapeHtml(input.fullName);
  const email = escapeHtml(input.email);
  const password = escapeHtml(input.password);
  await transport.sendMail({
    from: settings.from,
    to: input.email,
    subject: "Tài khoản đã được cấp / Account issued — NSClub Help Desk",
    text: `TÀI KHOẢN ĐÃ ĐƯỢC CẤP\n\nXin chào ${input.fullName},\nYêu cầu của bạn đã được xác nhận.\nID nhân viên: ${input.email}\nMật khẩu tạm thời: ${input.password}\nĐăng nhập tại: ${settings.baseUrl}/login\nĐây là tài khoản demo. Không dùng lại mật khẩu cho tài khoản khác.\n\nACCOUNT ISSUED\n\nHello ${input.fullName},\nYour request has been approved.\nEmployee ID: ${input.email}\nTemporary password: ${input.password}\nSign in at: ${settings.baseUrl}/login\nThis is a demo account. Do not reuse this password for another account.`,
    html: `<main><section lang="vi"><h1>Tài khoản đã được cấp</h1><p>Xin chào ${fullName},</p><p>Yêu cầu của bạn đã được xác nhận.</p><p><strong>ID nhân viên:</strong> ${email}</p><p><strong>Mật khẩu tạm thời:</strong> <code>${password}</code></p><p><a href="${escapeHtml(new URL("/login", settings.baseUrl).toString())}">Đăng nhập vào NSClub Help Desk</a></p><p>Đây là tài khoản demo. Không dùng lại mật khẩu cho tài khoản khác.</p></section><hr><section lang="en"><h1>Employee account issued</h1><p>Hello ${fullName},</p><p>Your request has been approved.</p><p><strong>Employee ID:</strong> ${email}</p><p><strong>Temporary password:</strong> <code>${password}</code></p><p><a href="${escapeHtml(new URL("/login", settings.baseUrl).toString())}">Sign in to NSClub Help Desk</a></p><p>This is a demo account. Do not reuse this password for another account.</p></section></main>`,
  });
}

export function identityApprovalPage(copy: {
  titleVi: string;
  titleEn: string;
  messageVi: string;
  messageEn: string;
}, ok: boolean, errorStatus = 400) {
  const titleVi = escapeHtml(copy.titleVi);
  const titleEn = escapeHtml(copy.titleEn);
  const messageVi = escapeHtml(copy.messageVi);
  const messageEn = escapeHtml(copy.messageEn);
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${titleVi} / ${titleEn}</title></head><body style="font:16px system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:24px;color:#202124"><main><section lang="vi"><h1>${titleVi}</h1><p>${messageVi}</p><p>${ok ? "Bạn có thể đóng trang này." : "Kiểm tra lại email hoặc liên hệ quản trị viên hệ thống."}</p></section><hr><section lang="en"><h1>${titleEn}</h1><p>${messageEn}</p><p>${ok ? "You can close this page." : "Check the email or contact the system administrator."}</p></section></main></body></html>`, {
    status: ok ? 200 : errorStatus,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
