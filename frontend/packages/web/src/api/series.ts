import { http } from "./client.ts";

export interface SeriesItem {
  id: number;
  name: string;
  plugin: string;
  created_at: string;
}

export interface SeriesDetail extends SeriesItem {
  resources: Array<{
    id: number;
    name: string;
    plugin: string;
    type: string;
    language: string | null;
  }>;
}

export const seriesApi = {
  list(plugin?: string) {
    return http
      .get<SeriesItem[]>("/series", { params: plugin ? { plugin } : {} })
      .then((r) => r.data);
  },

  get(id: number) {
    return http.get<SeriesDetail>(`/series/${id}`).then((r) => r.data);
  },

  create(name: string, plugin: string) {
    return http.post<SeriesItem>("/series", { name, plugin }).then((r) => r.data);
  },

  addResource(seriesId: number, resourceId: number) {
    return http
      .post(`/series/${seriesId}/resources`, { resource_id: resourceId })
      .then((r) => r.data);
  },

  removeResource(seriesId: number, resourceId: number) {
    return http.delete(`/series/${seriesId}/resources/${resourceId}`).then((r) => r.data);
  },

  getMeta(plugin: string, resourceId: number) {
    return http
      .get<Record<string, unknown>>(`/resources/${plugin}/${resourceId}/meta`)
      .then((r) => r.data);
  },

  postMeta(plugin: string, resourceId: number, data: Record<string, unknown>) {
    return http
      .post<{ ok: boolean }>(`/resources/${plugin}/${resourceId}/meta`, data)
      .then((r) => r.data);
  },
};
