import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.e2e") });

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ...(process.env.CI
      ? [["junit", { outputFile: "test-results/junit.xml" }] as const]
      : []),
  ],

  use: {
    baseURL: process.env.FRONTEND_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.resolve(
          import.meta.dirname,
          ".auth/storageState.json",
        ),
      },
      testIgnore: /auth\/.*\.spec\.ts/,
    },
    {
      name: "unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: /auth\/.*\.spec\.ts/,
    },
  ],

  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",

  webServer: [
    {
      command: "cd .. && bin/dev",
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        RACK_ENV: "test",
        DATABASE_URL: `sqlite://${process.env.DATABASE_PATH ?? "db/e2e_test.sqlite3"}`,
        JWT_SECRET: process.env.JWT_SECRET ?? "changeme",
      },
    },
    {
      command: "cd ../frontend && pnpm --filter @res-mgr/web dev",
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
