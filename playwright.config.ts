import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  timeout: 45_000,

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "fr-CH",
    // Lausanne, so any geolocation the app asks for is plausible.
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          // Normally undefined, so Playwright uses its own managed browser.
          // Set PLAYWRIGHT_CHROMIUM_PATH to run against a Chromium the
          // environment already provides (a CI image, a sandbox) instead of
          // downloading one.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
          args: process.env.PLAYWRIGHT_CHROMIUM_PATH
            ? ["--no-sandbox", "--disable-dev-shm-usage"]
            : [],
        },
      },
    },
  ],

  webServer: {
    // Defaults to a throwaway SQLite file. Set E2E_DATABASE_URL to run the same
    // suite against Postgres — worth doing before a deploy, since that's what
    // production will actually be running on.
    //
    // MOCK_EXTERNAL stubs geocoding and weather, so the suite doesn't depend on
    // reaching Nominatim or Open-Meteo — or on the network at all.
    command: `DATABASE_URL="${process.env.E2E_DATABASE_URL ?? "file:./prisma/e2e.db"}" MOCK_EXTERNAL=1 npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/activities?limit=1`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
