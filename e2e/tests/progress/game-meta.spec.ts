import { test, expect } from "@playwright/test";
import { createResource, saveProgress, getProgress } from "../../fixtures/api.ts";
import { generateJwt } from "../../fixtures/auth.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Game meta", () => {
  test.afterAll(cleanupTestData);

  test("saves game metadata via API", async () => {
    const r = await createResource({
      name: "e2e-game-meta",
      plugin: "game",
      locations: ["C:\\\\Games\\\\meta-test"],
    });

    await saveProgress("game", r.id, {
      device: "e2e-browser",
      launcher: "steam",
      steam_app_id: "12345",
    });

    const records = await getProgress("game", r.id);
    expect(records.length).toBeGreaterThanOrEqual(1);
    const latest = records[records.length - 1];
    expect(latest).toMatchObject({
      launcher: "steam",
      steam_app_id: "12345",
    });
  });

  test("launch-ping updates last_played_at", async ({ request }) => {
    const r = await createResource({
      name: "e2e-game-ping",
      plugin: "game",
      locations: ["C:\\\\Games\\\\ping-test"],
    });

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
    const res = await request.post(
      `${backendUrl}/resources/game/${r.id}/launch-ping`,
      {
        headers: { Authorization: `Bearer ${generateJwt()}` },
      },
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("last_played_at");
  });
});
