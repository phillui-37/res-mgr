import type { AxiosResponse } from "axios";
import { http } from "./client.ts";
import type { Resource, ProgressRecord, ResourceFilter, PaginatedResponse, DuplicateGroup } from "@/types/index.ts";

function parsePagination<T>(res: AxiosResponse<T[]>): PaginatedResponse<T> {
  return {
    data: res.data,
    total: Number(res.headers["x-total-count"] ?? res.data.length),
    page: Number(res.headers["x-page"] ?? 1),
    perPage: Number(res.headers["x-per-page"] ?? res.data.length),
  };
}

export const resourcesApi = {
  list(filter: ResourceFilter = {}) {
    const { meta_cond, ...rest } = filter;
    const params = new URLSearchParams();
    (Object.entries(rest) as [string, unknown][]).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    meta_cond?.forEach((c) => params.append("meta_cond[]", c));
    return http
      .get<Resource[]>("/resources", { params })
      .then(parsePagination);
  },

  get(id: number) {
    return http.get<Resource>(`/resources/${id}`).then((r) => r.data);
  },

  create(data: Partial<Resource>) {
    return http.post<Resource>("/resources", data).then((r) => r.data);
  },

  update(id: number, data: Partial<Resource>) {
    return http.patch<Resource>(`/resources/${id}`, data).then((r) => r.data);
  },

  duplicates() {
    return http.get<DuplicateGroup[]>("/resources/duplicates").then((r) => r.data);
  },

  computeChecksum(id: number) {
    return http.post<{ id: number; checksum: string }>(`/resources/${id}/checksum`).then((r) => r.data);
  },

  removeRequest(id: number) {
    return http
      .post<{ status: string; resource_id: number }>(`/resources/${id}/remove-request`)
      .then((r) => r.data);
  },

  remove(id: number) {
    return http.delete(`/resources/${id}`).then((r) => r.data);
  },

  bulkUpdate(updates: Array<{ id: number } & Partial<Omit<Resource, "id" | "type" | "created_at" | "updated_at">>>) {
    return http
      .patch<Resource[]>("/resources", { updates })
      .then((r) => r.data);
  },

  bulkRemove(ids: number[]) {
    return http
      .delete<{ deleted: number[]; count: number }>("/resources", { data: { ids } })
      .then((r) => r.data);
  },

  // Plugin-scoped list (e.g. GET /resources/ebook)
  listByPlugin(plugin: string, filter: ResourceFilter = {}) {
    return http
      .get<Resource[]>(`/resources/${plugin}`, { params: filter })
      .then(parsePagination);
  },

  getProgress(plugin: string, id: number) {
    return http
      .get<ProgressRecord[]>(`/resources/${plugin}/${id}/progress`)
      .then((r) => r.data);
  },

  saveProgress(plugin: string, id: number, data: Partial<ProgressRecord>) {
    return http
      .post<{ ok: boolean }>(`/resources/${plugin}/${id}/progress`, data)
      .then((r) => r.data);
  },
};
