import { test, expect } from "@playwright/test";
import { createResource, saveProgress } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Video progress", () => {
  test.afterAll(cleanupTestData);

  test("saves and displays time progress in mm:ss format", async ({ page }) => {
    const r = await createResource({
      name: "e2e-video-progress",
      plugin: "video",
      locations: ["file:///video/progress.mp4"],
    });

    await saveProgress("video", r.id, {
      device: "e2e-browser",
      position_ms: 3600000,
      duration_ms: 7200000,
    });

    await page.goto(`/resources/video/${r.id}`);
    await expect(page.getByText("Progress")).toBeVisible();
    await expect(page.getByText("60:00")).toBeVisible();
    await expect(page.getByText("120:00")).toBeVisible();
  });
});
