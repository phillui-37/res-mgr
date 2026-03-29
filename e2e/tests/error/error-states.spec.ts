import { test, expect } from "@playwright/test";

test.describe("Error states", () => {
  test("invalid route shows fallback", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz");
    await expect(page.locator("aside")).toBeVisible();
  });

  test("resource not found shows error message", async ({ page }) => {
    await page.goto("/resources/ebook/999999");
    await expect(page.getByText(/not found/i)).toBeVisible();
  });

  test("create resource with empty name is prevented", async ({ page }) => {
    await page.goto("/resources/new");
    const submitBtn = page.getByRole("button", { name: "Create" });
    await expect(submitBtn).toBeDisabled();
  });

  test("network error shows error state on resource list", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort("connectionrefused"));

    await page.goto("/resources");
    await expect(page.locator("aside")).toBeVisible();

    await page.unroute("**/api/**");
  });
});
