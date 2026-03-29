import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { http } from "@/api/client.ts";
import { pluginsApi } from "@/api/plugins.ts";

const mock = new MockAdapter(http);

beforeEach(() => mock.reset());

const fakePlugin = { name: "ebook", version: "1.0.0", capabilities: ["inventory", "viewer", "progress"] };

describe("pluginsApi", () => {
  describe("list()", () => {
    it("GETs /plugins and returns the array", async () => {
      mock.onGet("/plugins").reply(200, [fakePlugin, { ...fakePlugin, name: "music" }]);

      const result = await pluginsApi.list();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ebook");
      expect(result[1].name).toBe("music");
    });

    it("returns empty array when no plugins loaded", async () => {
      mock.onGet("/plugins").reply(200, []);

      const result = await pluginsApi.list();
      expect(result).toEqual([]);
    });
  });

  describe("get()", () => {
    it("GETs /plugins/:name and returns plugin details", async () => {
      mock.onGet("/plugins/ebook").reply(200, fakePlugin);

      const result = await pluginsApi.get("ebook");
      expect(result.name).toBe("ebook");
      expect(result.capabilities).toContain("viewer");
    });

    it("rejects on 404", async () => {
      mock.onGet("/plugins/nonexistent").reply(404, { error: "Not found" });

      await expect(pluginsApi.get("nonexistent")).rejects.toThrow();
    });
  });
});
