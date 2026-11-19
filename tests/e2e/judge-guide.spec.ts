import { anonymousHeaders, expect, freshTest as test, type Page } from "./fixtures";
import { employeeIdentity, fillEmployeeIdentity, withRequesterIdentity } from "./intake-helpers";

for (const viewport of [{ width: 1280, height: 600 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`tour leaves header navigation reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/send-help");
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
    const tip = page.getByRole("region", { name: "Hướng dẫn thao tác" });
    await expect(tip).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const home = page.getByRole("link", { name: "VNG Support", exact: true });
    await home.scrollIntoViewIfNeeded();
    await expect.poll(async () => {
      const header = await page.locator(".site-header").boundingBox();
      const box = await tip.boundingBox();
      return header && box ? box.y >= header.y + header.height : false;
    }).toBe(true);
    // A real click must work with the tour open, without force or dismissing it.
    await home.click({ timeout: 5000 });
    await expect(page.getByRole("main", { name: "Chọn vai trò" })).toBeVisible();
    await expect(tip).not.toBeVisible();
  });
}

async function departmentGuideGeometry(page: Page) {
  return page.evaluate(() => {
    const department = document.querySelector<HTMLSelectElement>('[data-guide="sender-department"]');
    const ring = document.querySelector(".guide-target-ring");
    const arrow = document.querySelector<SVGPathElement>(".guide-arrow > path");
    const matrix = arrow?.getScreenCTM();
    if (!department || !ring || !arrow || !matrix) return null;
    const field = department.getBoundingClientRect();
    const highlight = ring.getBoundingClientRect();
    const end = arrow.getPointAtLength(arrow.getTotalLength());
    const point = new DOMPoint(end.x, end.y).matrixTransform(matrix);
    return {
      departmentRequired: department.required,
      ringTracksDepartment:
        Math.abs(highlight.left - (field.left - 4)) < 2 &&
        Math.abs(highlight.top - (field.top - 4)) < 2 &&
        Math.abs(highlight.width - (field.width + 8)) < 2 &&
        Math.abs(highlight.height - (field.height + 8)) < 2,
      arrowPointsToDepartment:
        point.x >= field.left - 2 && point.x <= field.right + 2 &&
        point.y >= field.top - 2 && point.y <= field.bottom + 2,
    };
  });
}

for (const mode of ["Mô tả vấn đề", "Chọn theo danh mục"]) {
  test(`${mode}: department guide follows the required field while resizing`, async ({ page }, info) => {
    await page.goto("/send-help");
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    const tip = page.getByRole("region", { name: "Hướng dẫn thao tác" });
    const department = page.getByLabel("Phòng ban", { exact: true });
    await expect(tip).toContainText("Chọn phòng ban");
    await expect(department).toHaveAttribute("required", "");
    const originalViewport = page.viewportSize()!;
    for (const viewport of [originalViewport, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await department.scrollIntoViewIfNeeded();
      await expect.poll(() => departmentGuideGeometry(page)).toEqual({
        departmentRequired: true,
        ringTracksDepartment: true,
        arrowPointsToDepartment: true,
      });
    }
    await page.setViewportSize(originalViewport);
    await department.scrollIntoViewIfNeeded();
    await expect.poll(() => departmentGuideGeometry(page)).toMatchObject({ departmentRequired: true, ringTracksDepartment: true, arrowPointsToDepartment: true });
    await page.screenshot({ path: `artifacts/guide-department-${info.project.name}-${mode === "Mô tả vấn đề" ? "freeform" : "structured"}.png` });
    await expect(department).toHaveAttribute("required", "");
    await expect(department).toHaveValue("");
    await expect(tip).toContainText("Chọn phòng ban");
    await department.selectOption("");
    await expect(tip).toContainText("Chọn phòng ban");
    await department.selectOption("engineering");
    await expect(tip).toContainText("2. Chọn nhóm hỗ trợ");
    await expect(department).toHaveAttribute("required", "");
    await expect(department).toHaveValue("engineering");
  });
}

test("structured sender tour points to the fields before the description", async ({ page }) => {
  await page.goto("/send-help");
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  const tip = page.getByRole("region", { name: "Hướng dẫn thao tác" });
  await page.getByRole("button", { name: "Chọn theo danh mục", exact: true }).click();
  await expect(tip).toContainText("Chọn phòng ban");
  await fillEmployeeIdentity(page);
  await page.getByLabel("Nhóm hỗ trợ", { exact: true }).selectOption("DATABASE");
  await expect(tip).toContainText("3. Chọn nhu cầu");
  await page.getByLabel("Nhu cầu cụ thể", { exact: true }).selectOption("DATABASE_READ_ACCESS");
  await expect(tip).toContainText("Điền thông tin theo danh mục");
  await expect(page.locator('[data-guide="sender-fields"]')).toBeVisible();
  await tip.getByRole("button", { name: "Tiếp theo", exact: true }).click();
  await expect(tip).toContainText("4. Mô tả tình huống");
  await page.getByLabel("Mô tả yêu cầu", { exact: true }).fill("Xin quyền chỉ đọc dữ liệu demo");
  await expect(tip).toContainText("5. Gửi để xem phản hồi");
});

test("login introduction is scrollable and the sign-in guide remains available", async ({ page }, info) => {
  await page.setExtraHTTPHeaders(anonymousHeaders);
  await page.goto("/login");
  const dialog = page.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("border-top-color", "rgb(240, 90, 34)");
  await expect(dialog.getByRole("button", { name: "Đã hiểu", exact: true })).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveCount(3);
  const scroll = page.getByLabel("Nội dung hướng dẫn sử dụng", { exact: true });
  expect(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const lockedScrollY = await page.evaluate(() => scrollY);
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByRole("button", { name: "Đã hiểu", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(lockedScrollY);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Đã hiểu", exact: true }).focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await scroll.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/judge-intro-${info.project.name}.png` });
  await dialog.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByLabel("ID nhân viên hoặc email")).toBeVisible();
  await page.getByText("Hướng dẫn sử dụng", { exact: true }).click();
  await expect(page.locator("details[open]").getByRole("link", { name: "Hướng dẫn nhân viên", exact: true })).toHaveAttribute("href", "/help/employee");
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Hướng dẫn nhân viên" })).toBeVisible();
  await page.reload();
  await expect(dialog).not.toBeVisible();
});

test("sender follows actual controls, sees feedback and does not repeat after returning home", async ({ page }, info) => {
  await page.setExtraHTTPHeaders({ "x-support-e2e-role": "requester" });
  await page.goto("/send-help");
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  const tip = page.getByRole("region", { name: "Hướng dẫn thao tác" });
  await expect(tip).toContainText("1. Chọn cách gửi");
  await page.getByRole("button", { name: "Mô tả vấn đề", exact: true }).click();
  await expect(tip).toContainText("Chọn phòng ban");
  await fillEmployeeIdentity(page);
  await expect(tip).toContainText("2. Chọn nhóm hỗ trợ");
  await page.getByLabel("Nhóm hỗ trợ", { exact: true }).selectOption("NETWORK_VPN");
  await expect(tip).toContainText("4. Mô tả tình huống");
  await page.getByLabel("Mô tả yêu cầu", { exact: true }).fill("VPN không kết nối");
  await expect(tip).toContainText("5. Gửi để xem phản hồi");
  await expect(page.getByLabel("Mô tả yêu cầu", { exact: true })).toBeFocused();
  await page.screenshot({ path: `artifacts/judge-sender-${info.project.name}.png` });
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(tip).toContainText("Kiểm tra phản hồi");
  await tip.getByRole("button", { name: "Tiếp theo" }).click();
  await expect(tip).toContainText("Xác nhận hoặc lưu hội thoại");
  await page.getByRole("button", { name: "Xác nhận và gửi yêu cầu" }).click();
  await expect(tip).toContainText("Theo dõi kết quả");
  await tip.getByRole("button", { name: "Tiếp theo" }).click();
  await expect(tip).toContainText("Thử các lựa chọn hỗ trợ");
  await page.getByRole("button", { name: "C. Giải thích bước này" }).click();
  await expect(tip).toContainText("Tiếp tục hỏi hoặc bổ sung");
  await expect(page.getByRole("heading", { name: "Giải thích bước 1" })).toBeVisible();
  await page.getByLabel("Hỏi tiếp", { exact: true }).fill("VPN vẫn không kết nối");
  await expect(tip).toContainText("Gửi nội dung tiếp theo");
  await page.getByRole("button", { name: "Gửi câu hỏi", exact: true }).click();
  await expect(tip).toContainText("Xem lại toàn bộ quá trình");
  await page.getByText("Lịch sử yêu cầu và hướng dẫn", { exact: true }).click();
  await expect(tip).not.toBeVisible();
  await page.getByRole("link", { name: "VNG Support", exact: true }).click();
  await page.getByRole("link", { name: "Tôi cần hỗ trợ", exact: true }).click();
  await expect(page).toHaveURL(/\/send-help$/);
  await expect(page.getByRole("heading", { name: "Tôi cần hỗ trợ", exact: true })).toBeVisible();
  await expect(tip).not.toBeVisible();
  await page.reload();
  await expect(tip).not.toBeVisible();
});

test("reviewer tour is independent and never executes a decision automatically", async ({ page, request, requesterRequest }, info) => {
  const response = await requesterRequest.post("/api/support/requests", { data: withRequesterIdentity({
    ...employeeIdentity, rawText: "Mở port 3389 public", mode: "freeform", serviceGroup: "OTHER", confirmed: true, idempotencyKey: crypto.randomUUID(),
  }) });
  expect(response.ok()).toBe(true);
  const { data: row } = await response.json();
  await page.goto("/review");
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  const tip = page.getByRole("region", { name: "Hướng dẫn thao tác" });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("1. Tìm yêu cầu cần xử lý");
  await page.getByLabel("Hiển thị", { exact: true }).selectOption("all");
  await expect(tip).toContainText("2. Mở một hồ sơ");
  await page.locator(`a[href="/review?requestId=${row.id}"]`).click();
  await expect(tip).toContainText("3. Đọc yêu cầu");
  await tip.getByRole("button", { name: "Tiếp theo" }).click();
  await page.getByLabel("Tin nhắn cho người gửi").fill("Dừng yêu cầu demo để kiểm tra nhật ký.");
  await expect(tip).toContainText("5. Chọn quyết định phù hợp");
  const unchanged = (await (await request.get(`/api/support/requests/${row.id}`)).json()).data;
  expect(unchanged.status).toBe("ESCALATED");
  await page.screenshot({ path: `artifacts/judge-reviewer-${info.project.name}.png` });
  await page.getByRole("button", { name: "Dừng xử lý", exact: true }).click();
  await expect(tip).toContainText("6. Kiểm tra nhật ký");
  await page.getByRole("button", { name: "Xem lịch sử & bằng chứng", exact: true }).click();
  await expect(page.locator("#request-audit")).toBeVisible();
  await expect(page.locator("#request-audit")).toContainText("Dừng yêu cầu demo để kiểm tra nhật ký.");
  await tip.getByRole("button", { name: "Hoàn tất hướng dẫn" }).click();
  await page.getByRole("link", { name: "VNG Support", exact: true }).click();
  await page.goto("/review");
  await expect(tip).not.toBeVisible();
});

test("a fresh tab offers the introduction and starts the requester tour again", async ({ page, context }) => {
  await page.setExtraHTTPHeaders(anonymousHeaders);
  await page.goto("/login");
  await expect(page.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" })).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await page.close();
  const fresh = await context.newPage();
  await fresh.setExtraHTTPHeaders(anonymousHeaders);
  await fresh.goto("/login");
  await expect(fresh.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" })).toBeVisible();
  await fresh.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await fresh.getByText("Hướng dẫn sử dụng", { exact: true }).click();
  await expect(fresh.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  await fresh.setExtraHTTPHeaders({ "x-support-e2e-role": "requester" });
  await fresh.goto("/send-help");
  await expect(fresh.getByRole("region", { name: "Hướng dẫn thao tác" })).toContainText("1. Chọn cách gửi");
});

test("sender and Admin introductions have separate dismiss state and Admin can reopen the guide", async ({ page }) => {
  await page.setExtraHTTPHeaders(anonymousHeaders);
  await page.goto("/login");
  const dialog = page.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();

  await page.setExtraHTTPHeaders({ "x-support-e2e-role": "admin" });
  await page.goto("/review");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await expect(page.getByRole("link", { name: "Hướng dẫn Admin", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hướng dẫn nhanh", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();

  await page.goto("/identity/authority");
  await expect(page.getByRole("link", { name: "Hướng dẫn Admin", exact: true })).toHaveAttribute("href", "/help/admin");
  await expect(page.getByRole("button", { name: "Hướng dẫn nhanh", exact: true })).toBeVisible();
});

test("authenticated intake stays usable and links to the employee guide", async ({ page }) => {
  await page.goto("/send-help");
  const introduction = page.getByRole("dialog", { name: "Bắt đầu cùng VNG Support" });
  if (await introduction.isVisible()) await introduction.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await expect(page.getByRole("link", { name: "Hướng dẫn", exact: true })).toBeVisible();
  await expect(page.getByLabel("Mô tả yêu cầu", { exact: true })).toBeVisible();
});
