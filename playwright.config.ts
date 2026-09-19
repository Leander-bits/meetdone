import { defineConfig, devices } from "@playwright/test";
// Keep browser verification separate from a developer's running app.
const port = process.env.PLAYWRIGHT_PORT || "3100";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
