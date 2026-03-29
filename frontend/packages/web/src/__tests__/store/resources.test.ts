import { describe, it, expect, beforeEach } from "vitest";
import { useResourceStore } from "@/store/resources.ts";

beforeEach(() => {
  useResourceStore.setState({ filter: { page: 1, per_page: 50 } });
});

describe("useResourceStore", () => {
  it("starts with default filter (page 1, per_page 50)", () => {
    const { filter } = useResourceStore.getState();
    expect(filter.page).toBe(1);
    expect(filter.per_page).toBe(50);
  });

  describe("setFilter()", () => {
    it("merges partial filter with existing state", () => {
      useResourceStore.getState().setFilter({ plugin: "music" });
      const { filter } = useResourceStore.getState();
      expect(filter.plugin).toBe("music");
      expect(filter.page).toBe(1); // preserved
      expect(filter.per_page).toBe(50); // preserved
    });

    it("overwrites existing keys when provided", () => {
      useResourceStore.getState().setFilter({ page: 3 });
      expect(useResourceStore.getState().filter.page).toBe(3);
    });

    it("can set multiple keys at once", () => {
      useResourceStore.getState().setFilter({ plugin: "video", page: 2, per_page: 10 });
      const { filter } = useResourceStore.getState();
      expect(filter.plugin).toBe("video");
      expect(filter.page).toBe(2);
      expect(filter.per_page).toBe(10);
    });

    it("can set name filter", () => {
      useResourceStore.getState().setFilter({ name: "test" });
      expect(useResourceStore.getState().filter.name).toBe("test");
    });

    it("can clear name filter with undefined", () => {
      useResourceStore.getState().setFilter({ name: "test" });
      useResourceStore.getState().setFilter({ name: undefined });
      expect(useResourceStore.getState().filter.name).toBeUndefined();
    });
  });

  describe("resetFilter()", () => {
    it("resets to default filter", () => {
      useResourceStore.getState().setFilter({ plugin: "game", page: 5, per_page: 10 });
      useResourceStore.getState().resetFilter();
      const { filter } = useResourceStore.getState();
      expect(filter.page).toBe(1);
      expect(filter.per_page).toBe(50);
      expect(filter.plugin).toBeUndefined();
    });
  });
});
