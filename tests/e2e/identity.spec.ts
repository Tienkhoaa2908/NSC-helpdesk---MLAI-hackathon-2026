import { expect, test } from "./fixtures";

test("home exposes sign-in, registration and a persistent English switch", async ({ page }) => {
  await page.route("**/api/identity/session", (route) => route.fulfill({ status: 401, json: {
    success: false,
    error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in." },
  } }));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng ký", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tôi cần hỗ trợ", exact: true })).toHaveAttribute("href", "/send-help");
  await expect(page.getByRole("link", { name: "Dành cho Admin", exact: true })).toHaveAttribute("href", "/review");
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

test("employee sign-in sends the employee ID and password, then opens the protected requester form", async ({ requesterPage: page }) => {
  let signedIn = false;
  await page.route("**/api/identity/session", (route) => signedIn
    ? route.fulfill({ json: { success: true, data: { status: "ACTIVE", id: "guest01", name: "Tài khoản trải nghiệm", email: null } } })
    : route.fulfill({ status: 401, json: { success: false, error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in." } } }));
  await page.route("**/api/identity/logout", (route) => {
    signedIn = false;
    return route.fulfill({ json: { success: true, data: { loggedOut: true } } });
  });
  await page.route("**/api/identity/login", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ employeeId: "guest01", password: "12345" });
    signedIn = true;
    await route.fulfill({ json: { success: true, data: { status: "ACTIVE", redirectTo: "/send-help" } } });
  });
  await page.goto("/login");
  await expect(page.getByLabel("ID nhân viên hoặc email")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu")).toHaveAttribute("type", "password");
  await expect(page.getByRole("note").getByText("guest01", { exact: true })).toBeVisible();
  await expect(page.getByRole("note").getByText("12345", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhân viên mới\?/ })).toBeVisible();
  await page.getByLabel("ID nhân viên hoặc email").fill("guest01");
  await page.getByLabel("Mật khẩu").fill("12345");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/send-help$/);
  await expect(page.getByRole("heading", { name: "Tôi cần hỗ trợ" })).toBeVisible();
  await expect(page.getByLabel("Phòng ban")).toBeVisible();
  await expect(page.getByText("ID: guest01")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("ID: guest01")).toBeVisible();
  await page.reload();
  await expect(page.getByText("ID: guest01")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tôi cần hỗ trợ", exact: true }).click();
  await expect(page).toHaveURL(/\/send-help$/);
  await expect(page.getByRole("heading", { name: "Tôi cần hỗ trợ" })).toBeVisible();
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
});

test("employee and Admin guides match the public demo access and issuance workflow in both locales", async ({ page }) => {
  await page.goto("/help/employee");
  await expect(page.getByText(/Trong public-demo, requester đã đăng nhập chỉ xem và thao tác hồ sơ gắn với các ca Verify do server tạo/)).toBeVisible();
  await page.getByRole("button", { name: "Chuyển sang tiếng Anh" }).click();
  await expect(page.getByText(/In public-demo mode, signed-in requester accounts can view and act only on records linked to server-created Verify fixtures/)).toBeVisible();
  await expect(page.getByText(/Account applications and decisions are Admin-only/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Switch to Vietnamese" }).click();
  await expect(page.getByText(/Trong public-demo, requester đã đăng nhập chỉ xem và thao tác hồ sơ gắn với các ca Verify do server tạo/)).toBeVisible();
  await page.goto("/help/admin");
  await expect(page.getByText(/thư thông báo có liên kết tới danh sách riêng\. Admin đăng nhập rồi chọn quyết định/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Chuyển sang tiếng Anh" }).click();
  await expect(page.getByText(/When email is enabled and all required mail settings are configured, the system sends an Admin a notification with a link to the private request list/)).toBeVisible();
});

test("invalid credentials are shown without creating a session", async ({ page }) => {
  await page.route("**/api/identity/session", (route) => route.fulfill({ status: 401, json: {
    success: false,
    error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in." },
  } }));
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

test("a returning requester who opens sign-in continues to the support form", async ({ requesterPage: page }) => {
  await page.route("**/api/identity/session", (route) => route.fulfill({ json: {
    success: true,
    data: { status: "ACTIVE", id: "EMP-E2E-001", name: "Local E2E requester", email: null },
  } }));
  await page.goto("/login");
  await expect(page).toHaveURL(/\/send-help$/);
  await expect(page.getByRole("heading", { name: "Tôi cần hỗ trợ" })).toBeVisible();
});

test("registration is available in Vietnamese and English and sends only a name and Gmail", async ({ page }) => {
  await page.route("**/api/identity/applications", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ fullName: "Synthetic Test Requester", email: "requester.e2e.000001@gmail.com" });
    await route.fulfill({ status: 201, json: { success: true, data: { id: "e2e-application", status: "PENDING", notificationStatus: "SENT" } } });
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

test("registration states when Mongo saved a request but its Admin email failed", async ({ page }) => {
  await page.route("**/api/identity/applications", (route) => route.fulfill({ json: {
    success: true,
    data: { id: "e2e-unsent-application", status: "PENDING", notificationStatus: "FAILED" },
  } }));
  await page.goto("/identity/new");
  await page.getByLabel("Họ và tên").fill("Synthetic Mail Failure");
  await page.getByLabel("Gmail").fill("mail.failure.e2e@gmail.com");
  await page.getByRole("button", { name: "Gửi yêu cầu cấp tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Yêu cầu đã lưu, chưa gửi được email" })).toBeVisible();
  await expect(page.getByText(/đã được lưu.*email thông báo chưa gửi được/i)).toBeVisible();
  await expect(page.getByText("guest01", { exact: true })).toBeVisible();
  await expect(page.getByText("12345", { exact: true })).toBeVisible();
});

test("Admin can explicitly approve or reject identity requests", async ({ page }) => {
  await page.route("**/api/identity/review?*", (route) => route.fulfill({ json: {
    success: true,
    data: { items: [{ id: "e2e-application", fullName: "Synthetic Test Requester", email: "requester.e2e.000001@gmail.com", status: "PENDING", createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z" }], hasMore: false },
  } }));
  let decisionBody: unknown;
  await page.route("**/api/identity/review/decision", async (route) => {
    decisionBody = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, data: { status: "APPROVED", email: "requester.e2e.000001@gmail.com" } } });
  });
  await page.goto("/identity/review");
  await expect(page.getByRole("heading", { name: "Yêu cầu cấp tài khoản" })).toBeVisible();
  await expect(page.getByText("Synthetic Test Requester")).toBeVisible();
  await expect(page.getByRole("link", { name: "requester.e2e.000001@gmail.com" })).toHaveAttribute("href", "mailto:requester.e2e.000001@gmail.com");
  await expect(page.getByRole("button", { name: "Xác nhận cấp tài khoản" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Từ chối yêu cầu" })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Xác nhận cấp tài khoản" }).click();
  await expect.poll(() => decisionBody).toEqual({ id: "e2e-application", decision: "APPROVE" });
});

test("authenticated requester can explore support review but not identity requests", async ({ requesterPage, requesterRequest }) => {
  await requesterPage.goto("/review");
  await expect(requesterPage.getByRole("heading", { name: "Tiếp nhận hỗ trợ" })).toBeVisible();
  await requesterPage.goto("/identity/review");
  await expect(requesterPage.getByRole("heading", { name: "Phần này chỉ dành cho Admin" })).toBeVisible();
  const supportQueue = await requesterRequest.get("/api/support/requests");
  const identityRequests = await requesterRequest.get("/api/identity/review?status=all");
  expect(supportQueue.status()).toBe(200);
  expect(identityRequests.status()).toBe(403);
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
