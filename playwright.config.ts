import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

// The matching test-server guard also requires the exact loopback host/port.
const e2eIdentitySecret = process.env.SUPPORT_E2E_IDENTITY_SECRET ?? randomBytes(32).toString("hex");
process.env.SUPPORT_E2E_IDENTITY_SECRET = e2eIdentitySecret;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "artifacts/e2e-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3227",
    trace: "retain-on-failure",
    extraHTTPHeaders: {
      "x-support-e2e-identity": e2eIdentitySecret,
      "x-support-e2e-role": "admin",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      `node node_modules/next/dist/bin/next ${process.env.SUPPORT_E2E_PRODUCTION === "true" ? "start" : "dev"} --hostname 127.0.0.1 --port 3227`,
    url: "http://127.0.0.1:3227/api/support/health",
    reuseExistingServer: false,
    env: {
      AI_PROVIDER: "mock",
      AI_TEST_MAX_ATTEMPTS: "0",
      SUPPORT_STORAGE: "memory-demo",
      SUPPORT_ACCESS_MODE: "public-demo",
      SUPPORT_VERIFY_FAULTS: "true",
      SUPPORT_E2E_PRODUCTION: "true",
      SUPPORT_E2E_IDENTITY_SECRET: e2eIdentitySecret,
      MONGODB_URI: "",
      IDENTITY_MONGODB_URI: "",
      IDENTITY_MONGODB_DB: "",
      OPENAI_API_KEY: "",
      // Test-only key for the isolated memory-backed server; never use in a deployment.
      SUPPORT_TRACKING_SECRET: "a".repeat(64),
    },
    timeout: 120_000,
  },
});
