import { test, expect } from "@playwright/test";
import {
  createResource,
  deleteResource,
  getPluginMeta,
  postPluginMeta,
} from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Plugin extended metadata", () => {
  test.afterAll(cleanupTestData);

  test("ebook meta: POST then GET round-trip", async () => {
    const r = await createResource({ name: "e2e-ebook-meta", plugin: "ebook" });

    await postPluginMeta("ebook", r.id, {
      author: "Jane Doe",
      isbn: "978-0-00000-000-0",
      language: "en",
      genre: "fiction",
      page_count: 320,
    });

    const meta = await getPluginMeta("ebook", r.id);
    expect(meta.author).toBe("Jane Doe");
    expect(meta.isbn).toBe("978-0-00000-000-0");
    expect(meta.language).toBe("en");
    expect(meta.genre).toBe("fiction");
    expect(meta.page_count).toBe(320);

    await deleteResource(r.id);
  });

  test("music meta: POST then GET round-trip", async () => {
    const r = await createResource({ name: "e2e-music-meta", plugin: "music" });

    await postPluginMeta("music", r.id, {
      artist: "Test Artist",
      album: "Test Album",
      year: 2024,
      duration_ms: 210000,
    });

    const meta = await getPluginMeta("music", r.id);
    expect(meta.artist).toBe("Test Artist");
    expect(meta.album).toBe("Test Album");
    expect(meta.year).toBe(2024);
    expect(meta.duration_ms).toBe(210000);

    await deleteResource(r.id);
  });

  test("video meta: POST then GET round-trip", async () => {
    const r = await createResource({ name: "e2e-video-meta", plugin: "video" });

    await postPluginMeta("video", r.id, {
      director: "Test Director",
      year: 2023,
      resolution: "1920x1080",
    });

    const meta = await getPluginMeta("video", r.id);
    expect(meta.director).toBe("Test Director");
    expect(meta.year).toBe(2023);
    expect(meta.resolution).toBe("1920x1080");

    await deleteResource(r.id);
  });

  test("game meta: POST then GET includes extended fields", async () => {
    const r = await createResource({ name: "e2e-game-meta", plugin: "game" });

    await postPluginMeta("game", r.id, {
      developer: "Test Studio",
      dlsite_id: "RJ123456",
      language: "ja",
      genre: "RPG",
    });

    const meta = await getPluginMeta("game", r.id);
    expect(meta.developer).toBe("Test Studio");
    expect(meta.dlsite_id).toBe("RJ123456");
    expect(meta.language).toBe("ja");
    expect(meta.genre).toBe("RPG");

    await deleteResource(r.id);
  });

  test("pic meta: POST then GET includes extended fields", async () => {
    const r = await createResource({ name: "e2e-pic-meta", plugin: "pic" });

    await postPluginMeta("pic", r.id, {
      creator: "Test Creator",
      circle: "Test Circle",
      language: "ja",
      event: "Comiket",
    });

    const meta = await getPluginMeta("pic", r.id);
    expect(meta.creator).toBe("Test Creator");
    expect(meta.circle).toBe("Test Circle");
    expect(meta.event).toBe("Comiket");

    await deleteResource(r.id);
  });

  test("online_viewer meta: POST then GET round-trip", async () => {
    const r = await createResource({ name: "e2e-ov-meta", plugin: "online_viewer" });

    await postPluginMeta("online_viewer", r.id, {
      title: "OV Title",
      original_url: "https://example.com/viewer/book123",
      language: "en",
    });

    const meta = await getPluginMeta("online_viewer", r.id);
    expect(meta.title).toBe("OV Title");
    expect(meta.original_url).toBe("https://example.com/viewer/book123");
    expect(meta.language).toBe("en");

    await deleteResource(r.id);
  });

  test("meta upsert: second POST updates existing record", async () => {
    const r = await createResource({ name: "e2e-ebook-upsert", plugin: "ebook" });

    await postPluginMeta("ebook", r.id, { author: "First Author" });
    await postPluginMeta("ebook", r.id, { author: "Updated Author", genre: "sci-fi" });

    const meta = await getPluginMeta("ebook", r.id);
    expect(meta.author).toBe("Updated Author");
    expect(meta.genre).toBe("sci-fi");

    await deleteResource(r.id);
  });
});
