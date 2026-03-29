import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  jwt: string | null;
  apiUrl: string;
  setJwt: (token: string) => void;
  setApiUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      jwt: null,
      apiUrl: "http://localhost:9292",
      setJwt: (jwt) => {
        localStorage.setItem("jwt", jwt);
        set({ jwt });
      },
      setApiUrl: (apiUrl) => set({ apiUrl }),
      logout: () => {
        localStorage.removeItem("jwt");
        set({ jwt: null });
      },
    }),
    { name: "res-mgr-auth" },
  ),
);
