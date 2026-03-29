import { test, expect } from "@playwright/test";
import { listPlugins, getPlugin } from "../../fixtures/api.ts";
import { generateJwt } from "../../fixtures/auth.ts";

test.describe("Plugin listing", () => {
  test("list all plugins returns 6 core plugins", async () => {
    const plugins = await listPlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(6);

    const names = plugins.map((p) => p.name);
    for (const expected of ["ebook", "music", "video", "game", "pic", "online_viewer"]) {
      expect(names).toContain(expected);
    }
  });

  test("get plugin detail returns version and capabilities", async () => {
    const plugin = await getPlugin("ebook");
    expect(plugin).toHaveProperty("name", "ebook");
    expect(plugin).toHaveProperty("version");
    expect(plugin).toHaveProperty("capabilities");
    expect(Array.isArray((plugin as { capabilities: unknown[] }).capabilities)).toBe(true);
  });

  test("plugin reload endpoint works", async ({ request }) => {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    const res = await request.post(
      `${backendUrl}/plugins/ebook/reload`,
      {
        headers: { Authorization: `Bearer ${generateJwt()}` },
      },
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("reloaded", true);
  });
});
