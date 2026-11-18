import { createTransport } from "nodemailer";
import { z } from "zod";
import { SupportError } from "./support-repository";

const emailSchema = z.string().trim().email().max(254);

function mailSettings() {
  if (process.env.IDENTITY_EMAIL_ENABLED !== "true")
    throw new SupportError("IDENTITY_EMAIL_NOT_APPROVED", "Email cấp tài khoản đang tắt cho đến khi nội dung mẫu và cấu hình được duyệt.", 503);
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

export async function sendAccountRequestNotice(input: { id: string; fullName: string; email: string }) {
  const { settings, transport } = transporter();
  const reviewUrl = new URL("/identity/review", settings.baseUrl).toString();
  const fullName = escapeHtml(input.fullName);
  const email = escapeHtml(input.email);
  const requestId = escapeHtml(input.id);
  await transport.sendMail({
    from: settings.from,
    to: settings.admin,
    subject: "Yêu cầu cấp tài khoản / Employee account request — NSClub Help Desk",
    text: "YÊU CẦU CẤP TÀI KHOẢN\n\nHọ tên: " + input.fullName +
      "\nEmail / ID nhân viên: " + input.email + "\nMã yêu cầu: " + input.id +
      "\n\nMở danh sách yêu cầu trong trang Admin: " + reviewUrl +
      "\nĐăng nhập bằng tài khoản Admin, sau đó chọn Xác nhận cấp tài khoản hoặc Từ chối. Mở liên kết này không tự thay đổi trạng thái." +
      "\n\nACCOUNT REQUEST\n\nName: " + input.fullName + "\nEmail / employee ID: " + input.email +
      "\nRequest ID: " + input.id + "\n\nOpen the account request list in Admin: " + reviewUrl +
      "\nSign in as Admin, then choose Approve and issue or Reject. Opening this link does not change the request state.",
    html: '<main><section lang="vi"><h1>Yêu cầu cấp tài khoản</h1><p><strong>Họ tên:</strong> ' + fullName +
      '</p><p><strong>Email / ID nhân viên:</strong> ' + email + '</p><p><strong>Mã yêu cầu:</strong> ' + requestId +
      '</p><p><a href="' + escapeHtml(reviewUrl) + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#f4511e;color:#111;font-weight:700;text-decoration:none">Mở danh sách yêu cầu</a></p>' +
      '<p>Đăng nhập bằng tài khoản Admin, sau đó chọn xác nhận cấp tài khoản hoặc từ chối. Mở liên kết này không tự thay đổi trạng thái.</p></section><hr>' +
      '<section lang="en"><h1>Employee account request</h1><p><strong>Name:</strong> ' + fullName +
      '</p><p><strong>Email / employee ID:</strong> ' + email + '</p><p><strong>Request ID:</strong> ' + requestId +
      '</p><p><a href="' + escapeHtml(reviewUrl) + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#f4511e;color:#111;font-weight:700;text-decoration:none">Open account requests</a></p>' +
      '<p>Sign in as Admin, then approve or reject the request. Opening this link does not change its state.</p></section></main>',
  });
}

export async function sendIssuedCredentials(input: { email: string; fullName: string; password: string }) {
  const { settings, transport } = transporter();
  const fullName = escapeHtml(input.fullName);
  const email = escapeHtml(input.email);
  const password = escapeHtml(input.password);
  const loginUrl = escapeHtml(new URL("/login", settings.baseUrl).toString());
  const loginTextUrl = new URL("/login", settings.baseUrl).toString();
  await transport.sendMail({
    from: settings.from,
    to: input.email,
    subject: "Tài khoản đã được cấp / Employee account issued — NSClub Help Desk",
    text: "TÀI KHOẢN ĐÃ ĐƯỢC CẤP\n\nXin chào " + input.fullName +
      ",\nYêu cầu cấp tài khoản của bạn đã được xác nhận.\nID nhân viên: " + input.email +
      "\nMật khẩu tạm thời: " + input.password + "\nĐăng nhập tại: " + loginTextUrl +
      "\nĐây là tài khoản demo. Không dùng lại mật khẩu cho tài khoản khác." +
      "\n\nACCOUNT ISSUED\n\nHello " + input.fullName +
      ",\nYour account request has been approved.\nEmployee ID: " + input.email +
      "\nTemporary password: " + input.password + "\nSign in at: " + loginTextUrl +
      "\nThis is a demo account. Do not reuse this password for another account.",
    html: '<main><section lang="vi"><h1>Tài khoản đã được cấp</h1><p>Xin chào ' + fullName +
      ',</p><p>Yêu cầu cấp tài khoản của bạn đã được xác nhận.</p><p><strong>ID nhân viên:</strong> ' + email +
      '</p><p><strong>Mật khẩu tạm thời:</strong> <code>' + password + '</code></p><p><a href="' + loginUrl +
      '">Đăng nhập vào NSClub Help Desk</a></p><p>Đây là tài khoản demo. Không dùng lại mật khẩu cho tài khoản khác.</p></section><hr>' +
      '<section lang="en"><h1>Employee account issued</h1><p>Hello ' + fullName +
      ',</p><p>Your account request has been approved.</p><p><strong>Employee ID:</strong> ' + email +
      '</p><p><strong>Temporary password:</strong> <code>' + password + '</code></p><p><a href="' + loginUrl +
      '">Sign in to NSClub Help Desk</a></p><p>This is a demo account. Do not reuse this password for another account.</p></section></main>',
  });
}

export async function sendAccountRequestRejected(input: { id: string; fullName: string; email: string }) {
  const { settings, transport } = transporter();
  const fullName = escapeHtml(input.fullName);
  const email = escapeHtml(input.email);
  const requestId = escapeHtml(input.id);
  const contactEmail = escapeHtml(settings.admin);
  await transport.sendMail({
    from: settings.from,
    to: input.email,
    subject: "Kết quả yêu cầu cấp tài khoản / Account request result — NSClub Help Desk",
    text: "KẾT QUẢ YÊU CẦU CẤP TÀI KHOẢN\n\nXin chào " + input.fullName +
      ",\nYêu cầu cấp tài khoản của bạn chưa được chấp thuận.\nEmail / ID đã đăng ký: " + input.email +
      "\nMã yêu cầu: " + input.id + "\nNếu cần làm rõ, hãy liên hệ quản trị viên tại " + settings.admin +
      ".\n\nACCOUNT REQUEST RESULT\n\nHello " + input.fullName +
      ",\nYour account request was not approved.\nRegistered email / ID: " + input.email +
      "\nRequest ID: " + input.id + "\nFor clarification, contact the administrator at " + settings.admin + ".",
    html: '<main><section lang="vi"><h1>Kết quả yêu cầu cấp tài khoản</h1><p>Xin chào ' + fullName +
      ',</p><p>Yêu cầu cấp tài khoản của bạn chưa được chấp thuận.</p><p><strong>Email / ID đã đăng ký:</strong> ' +
      email + '</p><p><strong>Mã yêu cầu:</strong> ' + requestId +
      '</p><p>Nếu cần làm rõ, hãy liên hệ <a href="mailto:' + contactEmail + '">quản trị viên</a>.</p></section><hr>' +
      '<section lang="en"><h1>Account request result</h1><p>Hello ' + fullName +
      ',</p><p>Your account request was not approved.</p><p><strong>Registered email / ID:</strong> ' + email +
      '</p><p><strong>Request ID:</strong> ' + requestId +
      '</p><p>For clarification, contact the <a href="mailto:' + contactEmail + '">administrator</a>.</p></section></main>',
  });
}
