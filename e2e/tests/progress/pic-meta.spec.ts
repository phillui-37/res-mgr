import { test, expect } from "@playwright/test";
import { createResource, saveProgress, getProgress } from "../../fixtures/api.ts";

test.describe("Pic meta", () => {
  test("saves pic metadata via API", async () => {
    const r = await createResource({
      name: "e2e-pic-meta",
      plugin: "pic",
      locations: ["file:///pics/meta-test.zip"],
    });

    await saveProgress("pic", r.id, {
      device: "e2e-browser",
      image_count: 42,
      cover_path: "/cover.jpg",
    });

    const records = await getProgress("pic", r.id);
    expect(records.length).toBeGreaterThanOrEqual(1);
    const latest = records[records.length - 1];
    expect(latest).toMatchObject({
      image_count: 42,
      cover_path: "/cover.jpg",
    });
  });
});
