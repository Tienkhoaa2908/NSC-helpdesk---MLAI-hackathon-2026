import { anonymousHeaders, expect, test } from "./fixtures";
import { mkdir } from "node:fs/promises";
import { fillEmployeeIdentity } from "./intake-helpers";

test("record a raw demo and verify reviewer override, stop and audit", async ({
  browser,
  extraHTTPHeaders,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "One desktop recording is sufficient.",
  );
  const context = await browser.newContext({
    extraHTTPHeaders,
    baseURL: "http://127.0.0.1:3227",
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: "test-results/demo-video",
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    for (const role of ["intro", "sender-intro", "reviewer-intro", "sender", "reviewer"]) sessionStorage.setItem(`vng-guide-v1:${role}`, "seen");
  });
  const video = page.video();
  try {
    await page.setExtraHTTPHeaders(anonymousHeaders);
    await page.goto("/");
    await page
      .getByRole("link", { name: "Tôi cần hỗ trợ", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsend-help$/);
    await expect(page.getByLabel("ID nhân viên hoặc email")).toBeVisible();
    await page.setExtraHTTPHeaders({});
    await page.goto("/send-help");
    await fillEmployeeIdentity(page);
    await page
      .getByLabel("Mô tả yêu cầu", { exact: true })
      .fill("Tôi tắt máy tính lúc về được không?");
    await page.getByRole("button", { name: "Gửi", exact: true }).click();
    await page.getByRole("button", { name: "Xác nhận và gửi yêu cầu" }).click();
    await expect(page).toHaveURL(/\/requests\/[a-f0-9-]+#token=[a-f0-9]{64}$/);
    await expect(page.getByText("Trạng thái:")).toContainText(
      "Đã có hướng dẫn",
    );
    const id = new URL(page.url()).pathname.split("/").at(-1);
    await page
      .getByRole("button", {
        name: "D. Chuyển cho nhân viên hỗ trợ",
        exact: true,
      })
      .click();
    await expect(page.getByText("Trạng thái:")).toContainText(
      "Đang chờ nhân viên hỗ trợ",
    );
    await page.goto(`/review?requestId=${id}`);
    await expect(
      page.getByRole("button", { name: "Điều chỉnh quyết định", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Tin nhắn cho người gửi")
      .fill("Cần làm rõ thời điểm tắt thiết bị trong demo.");
    await page
      .getByRole("button", { name: "Điều chỉnh quyết định", exact: true })
      .click();
    await expect(page.locator(".it-current-status")).toContainText(
      "Cần bạn bổ sung thông tin",
    );
    await page
      .getByLabel("Tin nhắn cho người gửi")
      .fill("Dừng hồ sơ demo sau khi kiểm tra thao tác điều chỉnh.");
    await page.getByRole("button", { name: "Dừng xử lý", exact: true }).click();
    await expect(page.locator(".it-current-status")).toContainText("Đã dừng xử lý");
    await expect(
      page.getByRole("button", { name: "Duyệt yêu cầu", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Xem lịch sử & bằng chứng", exact: true }).click();
    await page.locator("#request-audit").scrollIntoViewIfNeeded();
    const detail = await (
      await context.request.get(`/api/support/requests/${id}`)
    ).json();
    expect(
      detail.data.events.some(
        (e: { action: string }) => e.action === "OVERRIDE",
      ),
    ).toBe(true);
    expect(
      detail.data.events.some((e: { action: string }) => e.action === "STOP"),
    ).toBe(true);
    await page.goto("/verify");
    await page
      .getByRole("button", { name: /Chạy toàn bộ ca \(5\)|Run all cases \(5\)/ })
      .click();
    await expect(page.getByRole("status")).toContainText(/5\/5 · (?:Đạt:|Pass:) 5 · (?:Lỗi:|Fail:) 0/);
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await page.screenshot({
      path: "artifacts/verify-persisted.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
  await mkdir("submission", { recursive: true });
  await video?.saveAs("submission/DEMO-LOCAL-MOCK.webm");
});
