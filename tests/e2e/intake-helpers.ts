import type { Page } from "@playwright/test";

export const employeeIdentity = {
  fields: { department: "engineering", employeeId: "EMP-E2E-001" },
};

type RequesterPayload = Record<string, unknown> & { fields?: Record<string, string> };

export function withRequesterIdentity<T extends RequesterPayload>(input: T) {
  return { ...input, fields: { ...employeeIdentity.fields, ...input.fields } };
}

export async function fillEmployeeIdentity(page: Page) {
  await page.getByLabel("Phòng ban", { exact: true }).selectOption("engineering");
}
