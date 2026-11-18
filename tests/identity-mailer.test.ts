import { afterEach, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn(async (message: unknown) => { void message; }) }));
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ sendMail })),
}));

import { assertIdentityEmailConfigured, sendAccountRequestNotice, sendIssuedCredentials, sendAccountRequestRejected } from "@/lib/identity-mailer";

function configureMail() {
  vi.stubEnv("IDENTITY_EMAIL_ENABLED", "true");
  vi.stubEnv("SMTP_HOST", "smtp.example.test");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "mailer@example.test");
  vi.stubEnv("SMTP_PASSWORD", "test-only-password");
  vi.stubEnv("SMTP_FROM", "mailer@example.test");
  vi.stubEnv("IDENTITY_ADMIN_EMAIL", "admin@gmail.com");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
}

afterEach(() => {
  vi.unstubAllEnvs();
  sendMail.mockReset();
});

it("keeps identity email disabled until the templates are approved", async () => {
  vi.stubEnv("IDENTITY_EMAIL_ENABLED", "false");

  expect(() => assertIdentityEmailConfigured()).toThrow();
  await expect(sendAccountRequestNotice({ id: "request-1", fullName: "Demo Person", email: "person@gmail.com" }))
    .rejects.toMatchObject({ code: "IDENTITY_EMAIL_NOT_APPROVED", status: 503 });
  expect(sendMail).not.toHaveBeenCalled();
});

it("sends a fixed Admin template with escaped applicant data and a non-mutating review URL", async () => {
  configureMail();

  await sendAccountRequestNotice({ id: "request-1", fullName: "<img src=x>", email: "person@gmail.com" });

  const message = sendMail.mock.calls[0][0] as { subject: string; html: string; text: string; to: string };
  expect(message).toMatchObject({ to: "admin@gmail.com", subject: "Yêu cầu cấp tài khoản / Employee account request — NSClub Help Desk" });
  expect(message.html).toContain("&lt;img src=x&gt;");
  expect(message.html).not.toContain("<img src=x>");
  expect(message.text).toContain("http://localhost:3000/identity/review");
  expect(message.text).toContain("Mở liên kết này không tự thay đổi trạng thái.");
});

it("uses fixed approval and rejection subjects and sends credentials only to the applicant", async () => {
  configureMail();

  await sendIssuedCredentials({ email: "person@gmail.com", fullName: "Demo Person", password: "12345" });
  await sendAccountRequestRejected({ id: "request-2", fullName: "Demo Person", email: "person@gmail.com" });

  expect(sendMail.mock.calls.map(([message]) => (message as { subject: string }).subject)).toEqual([
    "Tài khoản đã được cấp / Employee account issued — NSClub Help Desk",
    "Kết quả yêu cầu cấp tài khoản / Account request result — NSClub Help Desk",
  ]);
  expect((sendMail.mock.calls[0][0] as { to: string }).to).toBe("person@gmail.com");
  expect((sendMail.mock.calls[0][0] as { text: string }).text).toContain("Mật khẩu tạm thời: 12345");
  expect((sendMail.mock.calls[1][0] as { text: string }).text).toContain("chưa được chấp thuận");
});
