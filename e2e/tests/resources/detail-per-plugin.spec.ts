import { test, expect } from "@playwright/test";
import { createResource } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Resource detail per plugin type", () => {
  test.afterAll(cleanupTestData);

  test("ebook detail shows EbookViewer reference", async ({ page }) => {
    const r = await createResource({
      name: "e2e-ebook-detail",
      plugin: "ebook",
      locations: ["file:///books/detail.epub"],
    });

    await page.goto(`/resources/ebook/${r.id}`);
    await expect(page.getByText("e2e-ebook-detail")).toBeVisible();
    await expect(page.getByText("ebook").first()).toBeVisible();
    await expect(page.getByText("file:///books/detail.epub")).toBeVisible();
    await expect(page.getByText("Progress")).toBeVisible();
  });

  test("music detail shows AudioPlayer reference", async ({ page }) => {
    const r = await createResource({
      name: "e2e-music-detail",
      plugin: "music",
      locations: ["file:///music/detail.mp3"],
    });

    await page.goto(`/resources/music/${r.id}`);
    await expect(page.getByText("e2e-music-detail")).toBeVisible();
    await expect(page.getByText("music").first()).toBeVisible();
    await expect(page.getByText("Progress")).toBeVisible();
  });

  test("video detail shows VideoPlayer reference", async ({ page }) => {
    const r = await createResource({
      name: "e2e-video-detail",
      plugin: "video",
      locations: ["file:///video/detail.mp4"],
    });

    await page.goto(`/resources/video/${r.id}`);
    await expect(page.getByText("e2e-video-detail")).toBeVisible();
    await expect(page.getByText("video").first()).toBeVisible();
    await expect(page.getByText("Progress")).toBeVisible();
  });

  test("game detail shows Moonlight info", async ({ page }) => {
    const r = await createResource({
      name: "e2e-game-detail",
      plugin: "game",
      locations: ["C:\\\\Games\\\\detail"],
    });

    await page.goto(`/resources/game/${r.id}`);
    await expect(page.getByText("e2e-game-detail")).toBeVisible();
    await expect(page.getByText("game").first()).toBeVisible();
    await expect(page.getByText("Moonlight")).toBeVisible();
  });

  test("pic detail shows image element", async ({ page }) => {
    const r = await createResource({
      name: "e2e-pic-detail",
      plugin: "pic",
      locations: ["file:///pics/detail.zip"],
    });

    await page.goto(`/resources/pic/${r.id}`);
    await expect(page.getByText("e2e-pic-detail")).toBeVisible();
    await expect(page.getByText("pic").first()).toBeVisible();
    const img = page.locator("img");
    await expect(img).toBeVisible();
  });

  test("online_viewer detail shows WebView info", async ({ page }) => {
    const r = await createResource({
      name: "e2e-viewer-detail",
      plugin: "online_viewer",
      locations: ["https://example.com/test"],
    });

    await page.goto(`/resources/online_viewer/${r.id}`);
    await expect(page.getByText("e2e-viewer-detail")).toBeVisible();
    await expect(page.getByText("online_viewer").first()).toBeVisible();
    await expect(page.getByText("WebView")).toBeVisible();
  });
});
