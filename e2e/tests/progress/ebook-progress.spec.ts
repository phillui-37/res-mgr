import { test, expect } from "@playwright/test";
import { createResource, saveProgress } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Ebook progress", () => {
  test.afterAll(cleanupTestData);

  test("saves and displays page progress", async ({ page }) => {
    const r = await createResource({
      name: "e2e-ebook-progress",
      plugin: "ebook",
      locations: ["file:///books/progress.epub"],
    });

    await saveProgress("ebook", r.id, {
      device: "e2e-browser",
      current_page: 42,
      total_pages: 300,
      percentage: 14.0,
    });

    await page.goto(`/resources/ebook/${r.id}`);
    await expect(page.getByText("Progress")).toBeVisible();
    await expect(page.getByText("Page 42 / 300")).toBeVisible();
    await expect(page.getByText("14.0%")).toBeVisible();
  });
});
