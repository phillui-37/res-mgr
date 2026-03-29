import { test, expect } from "@playwright/test";
import { generateJwt } from "../../fixtures/auth.ts";

test.describe("Settings page", () => {
  test("save JWT persists across page reload", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toHaveText("Settings");

    const token = generateJwt("settings-persist-user");

    await page.locator("#jwt-token").fill(token);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();

    await page.reload();
    const inputValue = await page.locator("#jwt-token").inputValue();
    expect(inputValue).toBe(token);
  });

  test("save API URL updates backend target", async ({ page }) => {
    await page.goto("/settings");
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    await page.locator("#api-url").fill(backendUrl);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();

    const savedUrl = await page.evaluate(() => localStorage.getItem("apiUrl"));
    expect(savedUrl).toBe(backendUrl);
  });

  test("logout clears JWT and redirects", async ({ page }) => {
    await page.goto("/settings");

    await page.getByRole("button", { name: "Log out" }).click();

    const jwt = await page.evaluate(() => localStorage.getItem("jwt"));
    expect(jwt).toBeNull();

    await page.goto("/resources");
    await page.waitForURL("**/settings");
  });
});
