import { test as base } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
export { expect, type Page } from "@playwright/test";

export type RequestTrackingReceipt = { id: string; trackingToken: string };
export const requesterLink = (request: RequestTrackingReceipt) => `/requests/${request.id}#token=${request.trackingToken}`;
export const requesterTokenHeader = (request: RequestTrackingReceipt) => ({ "x-tracking-token": request.trackingToken });

// Each test models an independent client. Keep production rate limiting enabled
// without making unrelated scenarios exhaust a shared loopback-IP allowance.
export const freshTest = base.extend({
  extraHTTPHeaders: async ({}, provideHeaders, info) => {
    const hash = createHash("sha256").update(`${info.project.name}:${info.testId}`).digest();
    await provideHeaders({ "x-forwarded-for": `198.18.${hash[0]}.${hash[1]}` });
  },
  // Direct API submissions in E2E setup need the same opaque receipt proof as
  // the browser flow. Each test gets synthetic, isolated proof material.
  request: async ({ playwright }, provideRequest, info) => {
    const hash = createHash("sha256").update(`${info.project.name}:${info.testId}`).digest();
    const context = await playwright.request.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": `198.18.${hash[0]}.${hash[1]}`,
        "x-tracking-proof": randomBytes(32).toString("hex"),
      },
    });
    await provideRequest(context);
    await context.dispose();
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
