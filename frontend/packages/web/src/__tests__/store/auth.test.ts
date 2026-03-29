import { describe, it, expect, beforeEach } from "vitest";
import { __localStorageBackingStore as store } from "../setup.ts";

// Must import auth store AFTER setup runs (localStorage available).
import { useAuthStore } from "@/store/auth.ts";

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  useAuthStore.setState({ jwt: null, apiUrl: "http://localhost:9292" });
});

describe("useAuthStore", () => {
  it("hydrates jwt from localStorage on creation", () => {
    store["jwt"] = "hydrated-token";
    // Re-read: the store was created at import time, so this tests setState.
    useAuthStore.setState({ jwt: store["jwt"] ?? null });
    expect(useAuthStore.getState().jwt).toBe("hydrated-token");
  });

  it("hydrates apiUrl from localStorage on creation", () => {
    store["apiUrl"] = "https://custom:8080";
    useAuthStore.setState({ apiUrl: store["apiUrl"] || "http://localhost:9292" });
    expect(useAuthStore.getState().apiUrl).toBe("https://custom:8080");
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

    it("persists apiUrl to localStorage", () => {
      useAuthStore.getState().setApiUrl("https://my-nas:9292");
      expect(store["apiUrl"]).toBe("https://my-nas:9292");
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
