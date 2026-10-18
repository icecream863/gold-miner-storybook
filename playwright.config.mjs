import { defineConfig } from "@playwright/test";
import fs from "node:fs";

fs.mkdirSync("output/playwright", { recursive: true });
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 180000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  outputDir: "output/browser-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/browser-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel:
      process.env.PW_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
