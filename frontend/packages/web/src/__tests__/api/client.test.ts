import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { http } from "@/api/client.ts";
import {
  __localStorageBackingStore as store,
  __locationMock as locationMock,
} from "../setup.ts";

const mock = new MockAdapter(http);

beforeEach(() => {
  mock.reset();
  Object.keys(store).forEach((k) => delete store[k]);
  locationMock.href = "";
});

describe("api/client.ts interceptors", () => {
  describe("request interceptor — JWT injection", () => {
    it("adds Authorization header when jwt is in localStorage", async () => {
      store["jwt"] = "test-token-xyz";
      mock.onGet("/ping").reply(200, { ok: true });

      const res = await http.get("/ping");
      expect(res.config.headers.Authorization).toBe("Bearer test-token-xyz");
    });

    it("does NOT add Authorization header when jwt is absent", async () => {
      mock.onGet("/ping").reply(200, { ok: true });

      const res = await http.get("/ping");
      expect(res.config.headers.Authorization).toBeUndefined();
    });
  });

  describe("response interceptor — 401 redirect", () => {
    it("redirects to /settings on 401 response", async () => {
      mock.onGet("/protected").reply(401, { error: "Unauthorized" });

      await expect(http.get("/protected")).rejects.toThrow();
      expect(locationMock.href).toBe("/settings");
    });

    it("does NOT redirect on 403", async () => {
      mock.onGet("/forbidden").reply(403, { error: "Forbidden" });

      await expect(http.get("/forbidden")).rejects.toThrow();
      expect(locationMock.href).toBe("");
    });

    it("does NOT redirect on 500", async () => {
      mock.onGet("/error").reply(500, { error: "Server error" });

      await expect(http.get("/error")).rejects.toThrow();
      expect(locationMock.href).toBe("");
    });
  });
});
