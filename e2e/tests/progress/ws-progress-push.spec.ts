import { test, expect } from "@playwright/test";
import { createResource, saveProgress } from "../../fixtures/api.ts";
import { connectHub } from "../../fixtures/ws.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("WebSocket progress push", () => {
  test.afterAll(cleanupTestData);

  test("receives music progress event via WS", async () => {
    const r = await createResource({
      name: "e2e-ws-music",
      plugin: "music",
      locations: ["file:///music/ws-test.mp3"],
    });

    const client = await connectHub([`progress/music/${r.id}`]);

    try {
      await saveProgress("music", r.id, {
        device: "e2e-ws-test",
        position_ms: 60000,
        duration_ms: 180000,
      });

      const msg = await client.waitForMessage("progress", 10_000);
      expect(msg).toMatchObject({ type: "progress" });
    } finally {
      await client.close();
    }
  });

  test("receives ebook progress event via WS", async () => {
    const r = await createResource({
      name: "e2e-ws-ebook",
      plugin: "ebook",
      locations: ["file:///books/ws-test.epub"],
    });

    const client = await connectHub([`progress/ebook/${r.id}`]);

    try {
      await saveProgress("ebook", r.id, {
        device: "e2e-ws-test",
        current_page: 10,
        total_pages: 200,
        percentage: 5.0,
      });

      const msg = await client.waitForMessage("progress", 10_000);
      expect(msg).toMatchObject({ type: "progress" });
    } finally {
      await client.close();
    }
  });
});
