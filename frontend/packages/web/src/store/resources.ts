import { create } from "zustand";
import type { ResourceFilter } from "@/types/index.ts";

interface ResourceState {
  filter: ResourceFilter;
  setFilter: (f: Partial<ResourceFilter>) => void;
  resetFilter: () => void;
}

const defaultFilter: ResourceFilter = { page: 1, per_page: 50 };

export const useResourceStore = create<ResourceState>()((set) => ({
  filter: defaultFilter,
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  resetFilter: () => set({ filter: defaultFilter }),
}));
