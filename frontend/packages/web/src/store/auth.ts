import { create } from "zustand";
import { http } from "@/api/client.ts";

interface AuthState {
  jwt: string | null;
  apiUrl: string;
  setJwt: (token: string) => void;
  setApiUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  jwt: localStorage.getItem("jwt"),
  apiUrl: localStorage.getItem("apiUrl") || "http://localhost:9292",
  setJwt: (jwt) => {
    localStorage.setItem("jwt", jwt);
    set({ jwt });
  },
  setApiUrl: (apiUrl) => {
    localStorage.setItem("apiUrl", apiUrl);
    http.defaults.baseURL = apiUrl;
    set({ apiUrl });
  },
  logout: () => {
    localStorage.removeItem("jwt");
    set({ jwt: null });
  },
}));
