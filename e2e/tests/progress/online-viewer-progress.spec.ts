import { test, expect } from "@playwright/test";
import { createResource, saveProgress, getProgress } from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Online viewer progress", () => {
  test.afterAll(cleanupTestData);

  test("saves and retrieves progress via API", async () => {
    const r = await createResource({
      name: "e2e-viewer-progress",
      plugin: "online_viewer",
      locations: ["https://example.com/manga/progress"],
    });

    await saveProgress("online_viewer", r.id, {
      device: "e2e-browser",
      progress_pct: 75,
      last_page: "ch-12",
    });

    const records = await getProgress("online_viewer", r.id);
    expect(records.length).toBeGreaterThanOrEqual(1);
    const latest = records[records.length - 1];
    expect(latest).toMatchObject({
      progress_pct: 75,
      last_page: "ch-12",
    });
  });
});
