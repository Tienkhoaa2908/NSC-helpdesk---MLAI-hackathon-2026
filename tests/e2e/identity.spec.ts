import { expect, test } from "./fixtures";

test("home exposes sign-in, registration and a persistent English switch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng ký", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tôi cần hỗ trợ", exact: true })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Dành cho Admin", exact: true })).toHaveAttribute("href", "/login?next=%2Freview");
  await expect(page.getByRole("link", { name: /không cần tài khoản/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Chuyển sang tiếng Anh" }).click();
  await expect(page.getByRole("heading", { name: /How can we help/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Switch to Vietnamese" }).click();
  await expect(page.getByRole("heading", { name: /Bạn cần hỗ trợ/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("employee sign-in sends the employee ID and password, then opens the protected requester form", async ({ page }) => {
  await page.route("**/api/identity/login", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ employeeId: "guest01", password: "12345" });
    await route.fulfill({ json: { success: true, data: { status: "ACTIVE", redirectTo: "/send-help" } } });
  });
  await page.route("**/api/identity/session", (route) => route.fulfill({
    json: { success: true, data: { status: "ACTIVE", id: "guest01", name: "Tài khoản trải nghiệm", email: null } },
  }));
  await page.goto("/login");
  await expect(page.getByLabel("ID nhân viên hoặc email")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu")).toHaveAttribute("type", "password");
  await expect(page.getByText("guest01", { exact: true })).toBeVisible();
  await expect(page.getByText("12345", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhân viên mới\?/ })).toBeVisible();
  await page.getByLabel("ID nhân viên hoặc email").fill("guest01");
  await page.getByLabel("Mật khẩu").fill("12345");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/send-help$/);
  await expect(page.getByRole("heading", { name: "Tôi cần hỗ trợ" })).toBeVisible();
  await expect(page.getByLabel("Phòng ban")).toBeVisible();
});

test("invalid credentials are shown without creating a session", async ({ page }) => {
  await page.route("**/api/identity/login", (route) => route.fulfill({
    status: 401,
    json: { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } },
  }));
  await page.goto("/login");
  await page.getByLabel("ID nhân viên hoặc email").fill("guest01");
  await page.getByLabel("Mật khẩu").fill("wrong");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ID hoặc mật khẩu không đúng" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("registration is available in Vietnamese and English and sends only a name and Gmail", async ({ page }) => {
  await page.route("**/api/identity/applications", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ fullName: "Synthetic Test Requester", email: "requester.e2e.000001@gmail.com" });
    await route.fulfill({ status: 201, json: { success: true, data: { id: "e2e-application", status: "PENDING" } } });
  });
  await page.goto("/identity/new");
  await expect(page.getByLabel("Họ và tên")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi yêu cầu cấp tài khoản" })).toBeVisible();
  await page.getByRole("button", { name: "Chuyển sang tiếng Anh" }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Gmail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send account request" })).toBeVisible();
  await page.getByLabel("Full name").fill("Synthetic Test Requester");
  await page.getByLabel("Gmail").fill("requester.e2e.000001@gmail.com");
  await page.getByRole("button", { name: "Send account request" }).click();
  await expect(page.getByRole("heading", { name: "Your account request has been sent" })).toBeVisible();
  await expect(page.getByText("You can try the system now")).toBeVisible();
  await expect(page.getByText("guest01", { exact: true })).toBeVisible();
  await expect(page.getByText("12345", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to the demo" })).toHaveAttribute("href", "/login");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Full name")).toBeVisible();
});

test("identity request list is read-only and exposes applicant details only to Admin", async ({ page }) => {
  await page.route("**/api/identity/review?*", (route) => route.fulfill({ json: {
    success: true,
    data: { items: [{ id: "e2e-application", fullName: "Synthetic Test Requester", email: "requester.e2e.000001@gmail.com", status: "PENDING", createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z" }], hasMore: false },
  } }));
  await page.goto("/identity/review");
  await expect(page.getByRole("heading", { name: "Yêu cầu cấp tài khoản" })).toBeVisible();
  await expect(page.getByText("Synthetic Test Requester")).toBeVisible();
  await expect(page.getByRole("link", { name: "requester.e2e.000001@gmail.com" })).toHaveAttribute("href", "mailto:requester.e2e.000001@gmail.com");
  await expect(page.getByRole("button", { name: /duyệt|cấp tài khoản/i })).toHaveCount(0);
  await expect(page.getByText("không có nút duyệt hoặc cấp tài khoản", { exact: false })).toBeVisible();
});

test("unauthenticated API requests cannot read identity or reviewer data or preview a support request", async ({ anonymousRequest }) => {
  const session = await anonymousRequest.get("/api/identity/session");
  const applications = await anonymousRequest.get("/api/identity/review?status=all");
  const queue = await anonymousRequest.get("/api/support/requests");
  const preview = await anonymousRequest.post("/api/support/preview", { data: {
    mode: "freeform", serviceGroup: "OTHER", rawText: "VPN không kết nối", fields: {},
    confirmed: false, idempotencyKey: crypto.randomUUID(),
  } });
  expect(session.status()).toBe(401);
  expect(applications.status()).toBe(401);
  expect(queue.status()).toBe(401);
  expect(preview.status()).toBe(401);
});

test("E2E test identity headers reach the protected session endpoint", async ({ request }) => {
  const response = await request.get("/api/identity/session");
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toMatchObject({ status: "ACTIVE", id: "EMP-E2E-001" });
});

test("direct navigation to the requester workspace requires authentication", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: {
    "x-support-e2e-identity": "",
    "x-support-e2e-role": "",
  } });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3227/send-help");
    await expect(page).toHaveURL(/\/login\?next=%2Fsend-help$/);
    await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
    await expect(page.getByLabel("ID nhân viên hoặc email")).toBeVisible();
  } finally {
    await context.close();
  }
});
