import { http } from "./client.ts";
import type { Plugin } from "@/types/index.ts";

export const pluginsApi = {
  list() {
    return http.get<Plugin[]>("/plugins").then((r) => r.data);
  },

  get(name: string) {
    return http.get<Plugin>(`/plugins/${name}`).then((r) => r.data);
  },
};
