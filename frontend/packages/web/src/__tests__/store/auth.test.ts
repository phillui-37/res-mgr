import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth.ts";
import { __localStorageBackingStore as store } from "../setup.ts";

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  useAuthStore.setState({ jwt: null, apiUrl: "http://localhost:9292" });
});

describe("useAuthStore", () => {
  it("starts with jwt=null", () => {
    expect(useAuthStore.getState().jwt).toBeNull();
  });

  it("starts with default apiUrl", () => {
    expect(useAuthStore.getState().apiUrl).toBe("http://localhost:9292");
  });

  describe("setJwt()", () => {
    it("sets jwt in Zustand state", () => {
      useAuthStore.getState().setJwt("my-token");
      expect(useAuthStore.getState().jwt).toBe("my-token");
    });

    it("persists jwt to localStorage under 'jwt' key", () => {
      useAuthStore.getState().setJwt("my-token");
      expect(store["jwt"]).toBe("my-token");
    });
  });

  describe("setApiUrl()", () => {
    it("updates apiUrl in Zustand state", () => {
      useAuthStore.getState().setApiUrl("https://my-nas:9292");
      expect(useAuthStore.getState().apiUrl).toBe("https://my-nas:9292");
    });
  });

  describe("logout()", () => {
    it("clears jwt in Zustand state", () => {
      useAuthStore.getState().setJwt("token");
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().jwt).toBeNull();
    });

    it("removes jwt from localStorage", () => {
      store["jwt"] = "token";
      useAuthStore.getState().logout();
      expect(store["jwt"]).toBeUndefined();
    });

    it("preserves apiUrl after logout", () => {
      useAuthStore.getState().setApiUrl("https://custom:8080");
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().apiUrl).toBe("https://custom:8080");
    });
  });
});
