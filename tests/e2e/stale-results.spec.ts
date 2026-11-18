import { expect, test } from "./fixtures";
import { employeeIdentity, fillEmployeeIdentity, withRequesterIdentity } from "./intake-helpers";

test("audit clears the previous filter and cursor when the next filter fails", async ({ page, requesterRequest }) => {
  const response = await requesterRequest.post("/api/support/requests", {
    data: withRequesterIdentity({ ...employeeIdentity, rawText: "Open port 3389 public", confirmed: true, idempotencyKey: crypto.randomUUID() }),
  });
  expect(response.ok()).toBe(true);
  const { data: row } = await response.json();
  await page.route("**/api/support/events?*", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    return route.fulfill(query ? {
      status: 503,
      json: { success: false, error: { message: "Synthetic audit unavailable" } },
    } : {
      json: { success: true, data: { items: row.events, total: 40, nextCursor: "30" } },
    });
  });
  await page.goto("/audit");
  await expect(page.locator(".support-timeline li").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải thêm lịch sử" })).toBeVisible();
  await page.getByLabel("Nội dung hoặc mã yêu cầu", { exact: true }).fill("synthetic-new-filter");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Synthetic audit unavailable");
  await expect(page.locator(".support-timeline li")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tải thêm lịch sử" })).toHaveCount(0);
  await expect(page.getByText("Chưa có sự kiện phù hợp.", { exact: true })).toHaveCount(0);
  await page.getByLabel("Nội dung hoặc mã yêu cầu", { exact: true }).fill("");
  await expect(page.locator(".support-timeline li").first()).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("audit keeps a metrics error visible after the event list loads", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/support/metrics", (route) => route.fulfill({
    status: 503, json: { success: false, error: { message: "Synthetic metrics unavailable" } },
  }));
  await page.route("**/api/support/events?*", async (route) => {
    await gate;
    await route.fulfill({ json: { success: true, data: { items: [], total: 23, nextCursor: null } } });
  });
  await page.goto("/audit");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Không tải được số liệu.");
  release();
  await expect(page.getByRole("status")).toContainText("0/23 sự kiện");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Không tải được số liệu.");
});

test("Judge input keeps its idempotency proof after readback failure and retries the same record", async ({ page }) => {
  await page.goto("/verify");
  await fillEmployeeIdentity(page);
  await page.getByLabel("Mã nhân viên", { exact: true }).fill(employeeIdentity.fields.employeeId);
  const submissions: Array<{ key: string; proof: string }> = [];
  page.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/support/requests")) {
      submissions.push({ key: request.postDataJSON().idempotencyKey, proof: request.headers()["x-tracking-proof"] });
    }
  });
  await page.getByLabel("Nội dung yêu cầu", { exact: true }).fill("Open port 3389 public");
  await page.getByRole("button", { name: /Đánh giá yêu cầu|Evaluate request/ }).click();
  await expect(page.getByText(/^Kiểm tra lưu trữ: PASS:/)).toBeVisible();

  await page.route("**/api/support/requests/*", (route) => route.fulfill({
    status: 503, json: { success: false, error: { message: "Synthetic readback unavailable" } },
  }));
  await page.getByLabel("Nội dung yêu cầu", { exact: true }).fill("Disable MFA for synthetic testing");
  await page.getByRole("button", { name: /Đánh giá yêu cầu|Evaluate request/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Không đọc lại được hồ sơ qua API.");
  await expect(page.getByText(/^Kiểm tra lưu trữ: PASS:/)).toHaveCount(0);
  await expect(page.getByText("Kiểm tra lưu trữ: Chưa xác minh: không đọc lại được hồ sơ qua API.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem hướng dẫn / chuyển admin" })).toBeVisible();

  await page.unroute("**/api/support/requests/*");
  await page.getByRole("button", { name: /Đánh giá yêu cầu|Evaluate request/ }).click();
  await expect(page.getByText(/^Kiểm tra lưu trữ: PASS:/)).toBeVisible();
  expect(submissions).toHaveLength(3);
  expect(submissions[1].key).toBe(submissions[2].key);
  expect(submissions[1].proof).toBe(submissions[2].proof);
});
