import { test, expect } from "@playwright/test";
import { createResource, saveProgress } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Music progress", () => {
  test.afterAll(cleanupTestData);

  test("saves and displays time progress in mm:ss format", async ({ page }) => {
    const r = await createResource({
      name: "e2e-music-progress",
      plugin: "music",
      locations: ["file:///music/progress.mp3"],
    });

    await saveProgress("music", r.id, {
      device: "e2e-browser",
      position_ms: 125000,
      duration_ms: 240000,
    });

    await page.goto(`/resources/music/${r.id}`);
    await expect(page.getByText("Progress")).toBeVisible();
    await expect(page.getByText("2:05")).toBeVisible();
    await expect(page.getByText("4:00")).toBeVisible();
  });
});
