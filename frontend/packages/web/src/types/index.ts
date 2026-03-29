// Shared domain types mirroring the backend API contracts.

export type PluginName = "ebook" | "music" | "video" | "game" | "pic" | "online_viewer";

export interface Resource {
  id: number;
  name: string;
  type: string;
  plugin: PluginName;
  locations: string[];
  tags: string[];
  checksum: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Progress records differ per plugin; this interface is a superset.
export interface ProgressRecord {
  id: number;
  resource_id: number;
  device: string;
  // ebook
  current_page?: number;
  total_pages?: number;
  percentage?: number;
  cfi_position?: string;
  // music / video
  position_ms?: number;
  duration_ms?: number;
  completed?: boolean;
  // online_viewer
  progress_pct?: number;
  last_page?: string;
  provider?: string;
  updated_at: string;
}

export interface Plugin {
  name: PluginName;
  version: string;
  capabilities: string[];
}

export interface P2PRoom {
  room_id: string;
  peer_count: number;
  shared_resources?: number[];
  ws_url?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface ApiError {
  error: string;
}

export type ResourceFilter = {
  plugin?: PluginName;
  name?: string;
  page?: number;
  per_page?: number;
};
