import { expect, requesterLink, test } from "./fixtures";
import { employeeIdentity, withRequesterIdentity } from "./intake-helpers";

test("a requester can retry confirmation after a lost response without creating a second request", async ({ page }) => {
  let loseFirstResponse = true;
  let saveCount = 0;
  await page.route("**/api/support/requests", async route => {
    if (route.request().method() !== "POST") return route.continue();
    saveCount++;
    if (loseFirstResponse) {
      loseFirstResponse = false;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/send-help");
  await page.getByLabel("Phòng ban", { exact: true }).selectOption("engineering");
  await page.getByLabel("Mô tả yêu cầu", { exact: true }).fill("VPN không kết nối");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.locator('[data-guide="sender-confirm"]')).toBeVisible();

  await page.locator('[data-guide="sender-confirm"]').click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Mất kết nối");
  await page.getByRole("button", { name: "Xác nhận và gửi yêu cầu", exact: true }).click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+#token=[a-f0-9]{64}$/i);
  expect(saveCount).toBe(2);
  await expect(page.getByText("VPN không kết nối", { exact: true })).toBeVisible();
});

test("the full tracking link grants access across reloads; a request ID alone does not", async ({ page, requesterRequest }) => {
  const response = await requesterRequest.post("/api/support/requests", { data: withRequesterIdentity({
    ...employeeIdentity, rawText: "VPN không kết nối", confirmed: true, idempotencyKey: crypto.randomUUID(),
  }) });
  expect(response.status()).toBe(201);
  const { data: row } = await response.json();

  await page.goto(`/requests/${row.id}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Liên kết theo dõi thiếu mã truy cập");
  await page.goto("/");
  await page.goto(requesterLink(row));
  await expect(page.getByRole("heading", { name: "Vấn đề bạn đã gửi" })).toBeVisible();
  await expect(page.getByText("VPN không kết nối", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vấn đề bạn đã gửi" })).toBeVisible();
  await expect(page.getByText("VPN không kết nối", { exact: true })).toBeVisible();
});

test("tracking reports a recoverable load error when the network is unavailable", async ({ page, requesterRequest }) => {
  const response = await requesterRequest.post("/api/support/requests", { data: withRequesterIdentity({
    ...employeeIdentity, rawText: "Máy in báo kẹt giấy", confirmed: true, idempotencyKey: crypto.randomUUID(),
  }) });
  expect(response.ok()).toBe(true);
  const { data: row } = await response.json();
  await page.route(`**/api/support/track/${row.id}`, route => route.abort());
  await page.goto(requesterLink(row));
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Không thể tải yêu cầu. Thử tải lại.");
});
