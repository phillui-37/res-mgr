import { test, expect } from "@playwright/test";
import {
  createResource,
  deleteResource,
  createSeries,
  addResourceToSeries,
  getSeries,
} from "../../fixtures/api.ts";
import { cleanupTestData } from "../../fixtures/cleanup.ts";

test.describe("Series management", () => {
  test.afterAll(cleanupTestData);

  test("create series and retrieve it", async () => {
    const series = await createSeries(`e2e-series-${Date.now()}`, "ebook");
    expect(series.id).toBeGreaterThan(0);
    expect(series.plugin).toBe("ebook");

    const detail = await getSeries(series.id);
    expect(detail.name).toBe(series.name);
    expect(detail.resources).toHaveLength(0);
  });

  test("add two resources to a series and list members", async () => {
    const r1 = await createResource({ name: "e2e-series-r1", plugin: "ebook" });
    const r2 = await createResource({ name: "e2e-series-r2", plugin: "ebook" });
    const series = await createSeries(`e2e-series-members-${Date.now()}`, "ebook");

    await addResourceToSeries(series.id, r1.id);
    await addResourceToSeries(series.id, r2.id);

    const detail = await getSeries(series.id);
    const memberIds = detail.resources.map((r) => r.id);
    expect(memberIds).toContain(r1.id);
    expect(memberIds).toContain(r2.id);

    await deleteResource(r1.id);
    await deleteResource(r2.id);
  });

  test("remove resource from series", async () => {
    const r = await createResource({ name: "e2e-series-remove", plugin: "ebook" });
    const series = await createSeries(`e2e-series-remove-${Date.now()}`, "ebook");

    await addResourceToSeries(series.id, r.id);
    let detail = await getSeries(series.id);
    expect(detail.resources.map((x) => x.id)).toContain(r.id);

    const { request } = await import("@playwright/test");
    const { generateJwt } = await import("../../fixtures/auth.ts");
    const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
    const ctx = await request.newContext({
      baseURL: BACKEND_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${generateJwt("e2e-series-user")}` },
    });
    const del = await ctx.delete(`/series/${series.id}/resources/${r.id}`);
    expect(del.ok()).toBe(true);

    detail = await getSeries(series.id);
    expect(detail.resources.map((x) => x.id)).not.toContain(r.id);

    await deleteResource(r.id);
  });

  test("adding duplicate resource to series is idempotent (no error)", async () => {
    const r = await createResource({ name: "e2e-series-dedup", plugin: "ebook" });
    const series = await createSeries(`e2e-series-dedup-${Date.now()}`, "ebook");

    await addResourceToSeries(series.id, r.id);
    await addResourceToSeries(series.id, r.id); // should not throw

    const detail = await getSeries(series.id);
    const count = detail.resources.filter((x) => x.id === r.id).length;
    expect(count).toBe(1);

    await deleteResource(r.id);
  });
});
