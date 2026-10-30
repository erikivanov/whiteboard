import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.WHITEBOARD_BASE_URL ?? "http://localhost:3001",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer:
    process.env.WHITEBOARD_STATIC_TEST || process.env.WHITEBOARD_BASE_URL
      ? undefined
      : {
          command: "npm run dev -- --port 3001",
          url: "http://localhost:3001",
          reuseExistingServer: true,
          timeout: 60000,
        },
});
