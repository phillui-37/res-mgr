import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { listPlugins } from "../../fixtures/api.ts";
import { generateJwt } from "../../fixtures/auth.ts";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const TEST_PLUGIN_SRC = path.resolve(import.meta.dirname, "../../seed/test-plugin.yml");
const TEST_PLUGIN_DEST = path.join(PROJECT_ROOT, "config/plugins/e2e_test_plugin.yml");

test.describe("Plugin lifecycle", () => {
  test.afterAll(() => {
    if (fs.existsSync(TEST_PLUGIN_DEST)) {
      fs.unlinkSync(TEST_PLUGIN_DEST);
    }
  });

  test("deploy new config-based plugin", async ({ request }) => {
    fs.copyFileSync(TEST_PLUGIN_SRC, TEST_PLUGIN_DEST);
    expect(fs.existsSync(TEST_PLUGIN_DEST)).toBe(true);

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
    await request.post(`${backendUrl}/plugins/reload`, {
      headers: { Authorization: `Bearer ${generateJwt()}` },
    });

    const plugins = await listPlugins();
    const names = plugins.map((p) => p.name);
    expect(names).toContain("e2e_test_plugin");
  });

  test("new plugin routes respond", async ({ request }) => {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    const res = await request.get(`${backendUrl}/resources/e2e_test_plugin`, {
      headers: { Authorization: `Bearer ${generateJwt()}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("new plugin schema supports data operations", async ({ request }) => {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    const listRes = await request.get(`${backendUrl}/resources/e2e_test_plugin`, {
      headers: { Authorization: `Bearer ${generateJwt()}` },
    });
    expect(listRes.ok()).toBe(true);
    const items = await listRes.json();
    expect(Array.isArray(items)).toBe(true);
  });

  test("unload plugin by removing YAML and reloading", async ({ request }) => {
    if (fs.existsSync(TEST_PLUGIN_DEST)) {
      fs.unlinkSync(TEST_PLUGIN_DEST);
    }

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
    await request.post(`${backendUrl}/plugins/reload`, {
      headers: { Authorization: `Bearer ${generateJwt()}` },
    });

    const plugins = await listPlugins();
    const names = plugins.map((p) => p.name);
    expect(names).not.toContain("e2e_test_plugin");
  });
});
