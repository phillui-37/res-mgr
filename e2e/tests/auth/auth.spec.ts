import { test, expect } from "../../fixtures/auth.ts";
import { generateJwt, buildStorageState } from "../../fixtures/auth.ts";

test.describe("Auth flows", () => {
  test("unauthenticated user is redirected to /settings", async ({
    unauthedPage: page,
  }) => {
    await page.goto("/resources");
    // The axios 401 interceptor in client.ts redirects to /settings
    await page.waitForURL("**/settings");
    await expect(page.locator("h1")).toHaveText("Settings");
  });

  test("setting JWT in settings enables authenticated access", async ({
    unauthedPage: page,
  }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toHaveText("Settings");

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
    await page.locator("#api-url").fill(backendUrl);

    const token = generateJwt("settings-test-user");
    await page.locator("#jwt-token").fill(token);

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();

    // Navigate to resources — should load data (not redirect back)
    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");
  });

  test("expired JWT triggers redirect to /settings", async ({ browser }) => {
    // Generate a token that already expired
    const expiredToken = generateJwt("expired-user", "-1h");
    const context = await browser.newContext({
      storageState: buildStorageState(expiredToken),
    });
    const page = await context.newPage();

    await page.goto("/resources");
    await page.waitForURL("**/settings");
    await expect(page.locator("h1")).toHaveText("Settings");

    await context.close();
  });

  test("API key auth works for programmatic access", async ({ request }) => {
    const token = generateJwt("api-key-test-user");
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    const res = await request.get(`${backendUrl}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(true);
  });
});
