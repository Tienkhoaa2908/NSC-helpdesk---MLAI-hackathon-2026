import { test, expect } from "./fixtures";

test("signed-in employee submits a request with the account ID and selected department", async ({ requesterPage: page }, info) => {
  await page.goto("/send-help");
  const department = page.getByLabel("Phòng ban", { exact: true });
  await expect(page.getByText(/Tài khoản nhân viên đang hoạt động · ID EMP-E2E-001/)).toBeVisible();
  await department.selectOption("marketing");
  await page.getByLabel("Mô tả yêu cầu", { exact: true }).fill("VPN không kết nối. Tôi nên kiểm tra gì an toàn?");

  const previewResponse = page.waitForResponse(response => response.url().endsWith("/api/support/preview"));
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  expect((await previewResponse).status()).toBe(200);

  const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/support/requests") && response.request().method() === "POST");
  await page.locator('[data-guide="sender-confirm"]').click();
  const saved = (await (await savedResponse).json()).data;
  expect(saved.input.requesterMode).toBeUndefined();
  expect(saved.input.guestDepartment).toBeUndefined();
  expect(saved.input.fields).toMatchObject({ employeeId: "emp-e2e-001", department: "marketing" });
  await expect(page).toHaveURL(new RegExp(`/requests/${saved.id}#token=${saved.trackingToken}$`));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vấn đề bạn đã gửi" })).toBeVisible();
  await expect(page.getByText("VPN không kết nối. Tôi nên kiểm tra gì an toàn?", { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/requester-${info.project.name}.png`, fullPage: true });
});

test("support submission is protected and the legacy guest URL redirects to sign-in", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: {
    "x-support-e2e-identity": "",
    "x-support-e2e-role": "",
  } });
  const anonymousPage = await context.newPage();
  const origin = "http://127.0.0.1:3227";
  try {
    await anonymousPage.goto(`${origin}/send-help`);
    await expect(anonymousPage).toHaveURL(/\/login\?next=%2Fsend-help$/);
    await expect(anonymousPage.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
    await expect(anonymousPage.getByLabel("ID nhân viên hoặc email")).toBeVisible();

    await anonymousPage.goto(`${origin}/guest`);
    await expect(anonymousPage).toHaveURL(/\/login\?next=%2Fsend-help$/);
    await expect(anonymousPage.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
    await expect(anonymousPage.getByLabel("Mô tả yêu cầu", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("each support request chooses its department while the signed-in employee ID stays fixed", async ({ requesterPage: page }) => {
  await page.goto("/send-help");
  await expect(page.getByText(/Tài khoản nhân viên đang hoạt động · ID EMP-E2E-001/)).toBeVisible();
  await page.getByLabel("Phòng ban", { exact: true }).selectOption("engineering");

  const otherTab = await page.context().newPage();
  await otherTab.goto("/send-help");
  await expect(otherTab.getByText(/Tài khoản nhân viên đang hoạt động · ID EMP-E2E-001/)).toBeVisible();
  await expect(otherTab.getByLabel("Phòng ban", { exact: true })).toHaveValue("");
  await expect(otherTab.getByRole("link", { name: /không cần tài khoản/i })).toHaveCount(0);
  await otherTab.close();
});

test("authenticated sensitive requests still route to staff review", async ({ requesterPage: page }) => {
  await page.goto("/send-help");
  await page.getByLabel("Phòng ban", { exact: true }).selectOption("engineering");
  await page.getByLabel("Mô tả yêu cầu", { exact: true }).fill("Tắt MFA để đăng nhập");
  const preview = page.waitForResponse(response => response.url().endsWith("/api/support/preview"));
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  expect((await (await preview).json()).data.decision.action).toBe("ESCALATE");
  await expect(page.getByRole("heading", { name: "Cần người phụ trách xem xét" })).toBeVisible();
});
