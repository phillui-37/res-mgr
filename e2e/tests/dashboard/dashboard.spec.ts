import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("renders resource count and plugin stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Dashboard");

    const statCards = page.locator(".grid-cols-3 > div");
    await expect(statCards).toHaveCount(3);

    await expect(page.getByText("Total Resources")).toBeVisible();
    await expect(page.getByText("Plugins Loaded")).toBeVisible();
    await expect(page.getByText("Active P2P Rooms")).toBeVisible();

    await expect(page.getByText("Loaded Plugins")).toBeVisible();
    for (const plugin of ["ebook", "music", "video", "game", "pic", "online_viewer"]) {
      await expect(page.getByText(plugin, { exact: true }).first()).toBeVisible();
    }
  });

  test("sidebar navigation works from dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Dashboard");

    await page.getByRole("link", { name: "Resources" }).click();
    await expect(page.locator("h1")).toHaveText("Resources");

    await page.getByRole("link", { name: "P2P Rooms" }).click();
    await expect(page.locator("h1")).toHaveText("P2P Rooms");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.locator("h1")).toHaveText("Settings");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.locator("h1")).toHaveText("Dashboard");
  });
});
