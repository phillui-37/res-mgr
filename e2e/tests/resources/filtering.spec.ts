import { test, expect } from "@playwright/test";

test.describe("Resource filtering", () => {
  test("filter by plugin type", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");

    await page.getByRole("button", { name: "Music" }).click();

    await expect(page.getByText("test-track.mp3")).toBeVisible();
    await expect(page.getByText("test-ebook.epub")).not.toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("test-ebook.epub")).toBeVisible();
    await expect(page.getByText("test-track.mp3")).toBeVisible();
  });

  test("filter by name search", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1")).toHaveText("Resources");

    await page.getByPlaceholder("Search by name…").fill("ebook");

    await expect(page.getByText("test-ebook.epub")).toBeVisible();
    await expect(page.getByText("test-track.mp3")).not.toBeVisible();

    await page.getByPlaceholder("Search by name…").fill("");
    await expect(page.getByText("test-track.mp3")).toBeVisible();
  });
});
