import { expect, freshTest as test, requesterLink } from "./fixtures";
import { employeeIdentity, fillEmployeeIdentity, withRequesterIdentity } from "./intake-helpers";

test("MLAI judge can run De A, inspect audit and evaluate a new input", async ({ page }) => {
  await page.goto("/verify");
  await page.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" }).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await page.getByRole("button", { name: /Chạy toàn bộ ca \(5\)|Run all cases \(5\)/ }).click();
  await expect(page.getByRole("status")).toContainText(/5\/5 · (?:Đạt:|Pass:) 5 · (?:Lỗi:|Fail:) 0/);
  const actual = page.getByRole("table").locator("tbody tr td:nth-child(3)");
  await expect(actual.filter({ hasText: "AUTO_APPROVE" })).toHaveCount(3);
  await expect(actual.filter({ hasText: "ESCALATE" })).toHaveCount(2);
  await page.getByText("Bằng chứng cho quyết định", { exact: true }).first().click();
  await expect(page.getByText("Ban tiếp nhận: Ban IT", { exact: false }).first()).toBeVisible();
  const resultsUrl = page.url();
  await page.getByRole("link", { name: "Mở hồ sơ / nhật ký" }).last().click();
  await expect(page).toHaveURL(/\/review\?requestId=/);
  await page.getByRole("region", { name: "Hướng dẫn thao tác" }).getByRole("button", { name: "Bỏ qua hướng dẫn", exact: true }).click();
  await page.getByRole("button", { name: "Xem lịch sử & bằng chứng", exact: true }).click();
  await page.getByRole("tab", { name: /^Lịch sử xử lý/ }).click();
  await expect(page.locator(".support-timeline")).toBeVisible();
  await expect(page.locator(".support-timeline time").first()).toBeVisible();
  await expect(page.locator("main")).toContainText("Quy tắc, bằng chứng và thông tin còn thiếu");
  const requestId = new URL(page.url()).searchParams.get("requestId");
  expect(requestId).toBeTruthy();
  await page.getByText("Quy tắc, bằng chứng và thông tin còn thiếu", { exact: true }).last().click();
  await expect(page.locator(".support-timeline")).toContainText("SEC-002");
  await page.goto(resultsUrl);
  await fillEmployeeIdentity(page);
  await page.getByLabel("Mã nhân viên", { exact: true }).fill(employeeIdentity.fields.employeeId);
  await page.getByLabel("Nội dung yêu cầu").fill("VPN không kết nối; lý do: kiểm tra mạng thử nghiệm");
  await page.getByRole("button", { name: /Đánh giá yêu cầu|Evaluate request/ }).click();
  await expect(page.getByRole("link", { name: "Xem hướng dẫn / chuyển admin" })).toHaveAttribute("href", /\/review\?requestId=/);
  await expect(page.getByRole("heading", { name: "Có thể hỗ trợ an toàn" })).toBeVisible();
});

test("synthetic PII and JSON OTP stay masked in API, audit and rendered history", async ({ page, request, requesterRequest }) => {
  const values = ["synthetic.person@example.invalid", "000-000-000-000", "123456", "EMP-SYNTHETIC-99"];
  const response = await requesterRequest.post("/api/support/requests", { data: withRequesterIdentity({
    ...employeeIdentity, rawText: `VPN lỗi; ${values[0]}; CCCD: ${values[1]}; {"otp":"${values[2]}"}; employee ID: ${values[3]}`,
    confirmed: true, idempotencyKey: crypto.randomUUID(),
  }) });
  expect(response.status()).toBe(201);
  const body = await response.text();
  for (const value of values) expect(body).not.toContain(value);
  const { data } = JSON.parse(body);
  const events = await request.get(`/api/support/events?requestId=${data.id}`);
  expect(events.status()).toBe(200);
  const audit = await events.text();
  for (const value of values) expect(audit).not.toContain(value);
  await page.goto(requesterLink(data));
  await expect(page.getByText("Trạng thái:")).toBeVisible();
  for (const value of values) await expect(page.locator("body")).not.toContainText(value);
  await expect(page.locator("body")).toContainText("REDACTED");
});
