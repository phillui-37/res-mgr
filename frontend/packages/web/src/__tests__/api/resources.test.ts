import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { http } from "@/api/client.ts";
import { resourcesApi } from "@/api/resources.ts";

const mock = new MockAdapter(http);

beforeEach(() => mock.reset());

const fakeResource = {
  id: 1, name: "test.epub", type: "ebook", plugin: "ebook",
  locations: ["/books/test.epub"], tags: [], checksum: null,
  active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

describe("resourcesApi", () => {
  describe("list()", () => {
    it("GETs /resources and parses pagination headers", async () => {
      mock.onGet("/resources").reply(200, [fakeResource], {
        "x-total-count": "42",
        "x-page": "2",
        "x-per-page": "10",
      });

      const result = await resourcesApi.list({ page: 2, per_page: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(42);
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(10);
    });

    it("falls back when pagination headers are absent", async () => {
      mock.onGet("/resources").reply(200, [fakeResource, fakeResource]);

      const result = await resourcesApi.list();
      expect(result.total).toBe(2); // fallback = data.length
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(2);
    });

    it("passes filter params as query string", async () => {
      mock.onGet("/resources").reply((config) => {
        expect(config.params).toEqual({ plugin: "music", page: 3 });
        return [200, [], {}];
      });

      await resourcesApi.list({ plugin: "music", page: 3 });
    });
  });

  describe("get()", () => {
    it("GETs /resources/:id and returns data directly", async () => {
      mock.onGet("/resources/7").reply(200, fakeResource);

      const result = await resourcesApi.get(7);
      expect(result.id).toBe(1);
      expect(result.name).toBe("test.epub");
    });
  });

  describe("create()", () => {
    it("POSTs to /resources", async () => {
      mock.onPost("/resources").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.name).toBe("new.pdf");
        return [200, { ...fakeResource, id: 2, name: "new.pdf" }];
      });

      const result = await resourcesApi.create({ name: "new.pdf", plugin: "ebook", type: "ebook" });
      expect(result.id).toBe(2);
    });
  });

  describe("update()", () => {
    it("PATCHes /resources/:id", async () => {
      mock.onPatch("/resources/1").reply(200, { ...fakeResource, name: "renamed.epub" });

      const result = await resourcesApi.update(1, { name: "renamed.epub" });
      expect(result.name).toBe("renamed.epub");
    });
  });

  describe("remove()", () => {
    it("DELETEs /resources/:id", async () => {
      mock.onDelete("/resources/1").reply(200, { deleted: 1 });

      const result = await resourcesApi.remove(1);
      expect(result.deleted).toBe(1);
    });
  });

  describe("listByPlugin()", () => {
    it("GETs /resources/:plugin with pagination", async () => {
      mock.onGet("/resources/music").reply(200, [], {
        "x-total-count": "5",
        "x-page": "1",
        "x-per-page": "50",
      });

      const result = await resourcesApi.listByPlugin("music");
      expect(result.total).toBe(5);
    });
  });

  describe("getProgress()", () => {
    it("GETs /resources/:plugin/:id/progress", async () => {
      const progress = [{ id: 1, resource_id: 5, device: "chrome", percentage: 45.0 }];
      mock.onGet("/resources/ebook/5/progress").reply(200, progress);

      const result = await resourcesApi.getProgress("ebook", 5);
      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(45.0);
    });
  });

  describe("saveProgress()", () => {
    it("POSTs to /resources/:plugin/:id/progress", async () => {
      mock.onPost("/resources/ebook/5/progress").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.device).toBe("kindle");
        return [200, { ok: true }];
      });

      const result = await resourcesApi.saveProgress("ebook", 5, { device: "kindle" });
      expect(result.ok).toBe(true);
    });
  });
});
