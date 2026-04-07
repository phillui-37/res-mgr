import { create } from "zustand";
import type { ResourceFilter } from "@/types/index.ts";

export const ALLOWED_PER_PAGE = [10, 25, 50, 100, 200] as const;
export type PerPage = typeof ALLOWED_PER_PAGE[number];

const STORAGE_KEY = "res_per_page";

function loadPerPage(): PerPage {
  const raw = parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
  return (ALLOWED_PER_PAGE as readonly number[]).includes(raw)
    ? (raw as PerPage)
    : 50;
}

interface ResourceState {
  filter: ResourceFilter;
  setFilter: (f: Partial<ResourceFilter>) => void;
  setPerPage: (n: PerPage) => void;
  resetFilter: () => void;
}

export const useResourceStore = create<ResourceState>()((set) => ({
  filter: { page: 1, per_page: loadPerPage() },
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  setPerPage: (n) => {
    localStorage.setItem(STORAGE_KEY, String(n));
    set((s) => ({ filter: { ...s.filter, per_page: n, page: 1 } }));
  },
  resetFilter: () => set({ filter: { page: 1, per_page: loadPerPage() } }),
}));
