import { test as base, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
export { expect, type Page } from "@playwright/test";

export type RequestTrackingReceipt = { id: string; trackingToken: string };
export const requesterLink = (request: RequestTrackingReceipt) => `/requests/${request.id}#token=${request.trackingToken}`;
export const requesterTokenHeader = (request: RequestTrackingReceipt) => ({ "x-tracking-token": request.trackingToken });
export const anonymousHeaders = {
  "x-support-e2e-identity": "",
  "x-support-e2e-role": "",
};
type ApiRoleFixtures = {
  requesterRequest: APIRequestContext;
  anonymousRequest: APIRequestContext;
  requesterPage: Page;
};

function testAddress(projectName: string, testId: string, role: string) {
  const hash = createHash("sha256").update(`${projectName}:${testId}:${role}`).digest();
  return `198.18.${hash[0]}.${hash[1]}`;
}

function testIdentityHeaders(info: TestInfo, role: "admin" | "requester") {
  const webServerEnvironment = Array.isArray(info.config.webServer)
    ? info.config.webServer[0]?.env
    : info.config.webServer?.env;
  const configured = info.project.use.extraHTTPHeaders as Record<string, string> | undefined;
  return {
    "x-support-e2e-identity": webServerEnvironment?.SUPPORT_E2E_IDENTITY_SECRET ?? configured?.["x-support-e2e-identity"] ?? process.env.SUPPORT_E2E_IDENTITY_SECRET ?? "",
    "x-support-e2e-role": role,
  };
}

// Each test models an independent client. Keep production rate limiting enabled
// without making unrelated scenarios exhaust a shared loopback-IP allowance.
export const freshTest = base.extend<ApiRoleFixtures>({
  extraHTTPHeaders: async ({}, provideHeaders, info) => {
    const address = testAddress(info.project.name, info.testId, "admin-page");
    await provideHeaders({
      ...(info.project.use.extraHTTPHeaders as Record<string, string> | undefined),
      "x-forwarded-for": address,
      "x-vercel-forwarded-for": address,
      ...testIdentityHeaders(info, "admin"),
    });
  },
  // Direct API submissions in E2E setup need the same opaque receipt proof as
  // the browser flow. Each test gets synthetic, isolated proof material.
  request: async ({ playwright }, provideRequest, info) => {
    const address = testAddress(info.project.name, info.testId, "admin-api");
    const context = await playwright.request.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": address,
        "x-vercel-forwarded-for": address,
        "x-tracking-proof": randomBytes(32).toString("hex"),
        ...testIdentityHeaders(info, "admin"),
      },
    });
    await provideRequest(context);
    await context.dispose();
  },
  requesterRequest: async ({ playwright }, provideRequest, info) => {
    const address = testAddress(info.project.name, info.testId, "requester-api");
    const context = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3227",
      extraHTTPHeaders: {
        "x-forwarded-for": address,
        "x-vercel-forwarded-for": address,
        "x-tracking-proof": randomBytes(32).toString("hex"),
        ...testIdentityHeaders(info, "requester"),
      },
    });
    await provideRequest(context);
    await context.dispose();
  },
  anonymousRequest: async ({ playwright }, provideRequest, info) => {
    const address = testAddress(info.project.name, info.testId, "anonymous-api");
    const context = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3227",
      extraHTTPHeaders: {
        "x-forwarded-for": address,
        "x-vercel-forwarded-for": address,
        ...anonymousHeaders,
      },
    });
    await provideRequest(context);
    await context.dispose();
  },
  requesterPage: async ({ browser }, providePage, info) => {
    const address = testAddress(info.project.name, info.testId, "requester-page");
    const context = await browser.newContext({ extraHTTPHeaders: {
      "x-forwarded-for": address,
      "x-vercel-forwarded-for": address,
      ...testIdentityHeaders(info, "requester"),
    } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      for (const role of ["intro", "sender-intro", "reviewer-intro", "sender", "reviewer"])
        sessionStorage.setItem(`vng-guide-v1:${role}`, "seen");
    });
    await providePage(page);
    await context.close();
  },
});

// Existing workflow regressions exercise a returning visitor. The onboarding
// suite uses freshTest and tests fresh tabs with no seeded flags.
export const test = freshTest.extend<{ returningVisitor: void }>({
  returningVisitor: [async ({ page }, use) => {
    await page.addInitScript(() => {
      for (const role of ["intro", "sender-intro", "reviewer-intro", "sender", "reviewer"]) {
        sessionStorage.setItem(`vng-guide-v1:${role}`, "seen");
      }
    });
    await use();
  }, { auto: true }],
});
