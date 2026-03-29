import { request, type APIRequestContext } from "@playwright/test";
import { generateJwt } from "./auth.ts";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

let _ctx: APIRequestContext | null = null;

async function ctx(): Promise<APIRequestContext> {
  if (!_ctx) {
    _ctx = await request.newContext({
      baseURL: BACKEND_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${generateJwt("e2e-seed-user")}`,
        "Content-Type": "application/json",
      },
    });
  }
  return _ctx;
}

export async function disposeApiContext(): Promise<void> {
  if (_ctx) {
    await _ctx.dispose();
    _ctx = null;
  }
}

export interface CreateResourceParams {
  name: string;
  plugin: string;
  type?: string;
  locations?: string[];
}

export async function createResource(data: CreateResourceParams) {
  const c = await ctx();
  const res = await c.post("/resources", {
    data: { ...data, type: data.type ?? data.plugin },
  });
  if (!res.ok()) {
    throw new Error(
      `createResource failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json() as Promise<{
    id: number;
    name: string;
    plugin: string;
    type: string;
    locations: string[];
  }>;
}

export async function getResource(id: number) {
  const c = await ctx();
  const res = await c.get(`/resources/${id}`);
  if (!res.ok()) throw new Error(`getResource failed: ${res.status()}`);
  return res.json();
}

export async function deleteResource(id: number) {
  const c = await ctx();
  const res = await c.delete(`/resources/${id}`);
  if (!res.ok()) throw new Error(`deleteResource failed: ${res.status()}`);
  return res.json();
}

export async function saveProgress(
  plugin: string,
  resourceId: number,
  data: Record<string, unknown>,
) {
  const c = await ctx();
  const res = await c.post(`/resources/${plugin}/${resourceId}/progress`, {
    data,
  });
  if (!res.ok()) {
    throw new Error(
      `saveProgress failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json();
}

export async function getProgress(plugin: string, resourceId: number) {
  const c = await ctx();
  const res = await c.get(`/resources/${plugin}/${resourceId}/progress`);
  if (!res.ok()) throw new Error(`getProgress failed: ${res.status()}`);
  return res.json() as Promise<Record<string, unknown>[]>;
}

export async function listPlugins() {
  const c = await ctx();
  const res = await c.get("/plugins");
  if (!res.ok()) throw new Error(`listPlugins failed: ${res.status()}`);
  return res.json() as Promise<
    Array<{ name: string; version: string; capabilities: string[] }>
  >;
}

export async function getPlugin(name: string) {
  const c = await ctx();
  const res = await c.get(`/plugins/${name}`);
  if (!res.ok()) throw new Error(`getPlugin failed: ${res.status()}`);
  return res.json();
}

export async function createRoom(roomId?: string) {
  const c = await ctx();
  const res = await c.post("/p2p/rooms", {
    data: roomId ? { room_id: roomId } : {},
  });
  if (!res.ok()) throw new Error(`createRoom failed: ${res.status()}`);
  return res.json() as Promise<{ room_id: string; ws_url: string }>;
}

export async function getRoom(roomId: string) {
  const c = await ctx();
  const res = await c.get(`/p2p/rooms/${roomId}`);
  if (!res.ok()) throw new Error(`getRoom failed: ${res.status()}`);
  return res.json();
}

export async function shareResource(roomId: string, resourceId: number) {
  const c = await ctx();
  const res = await c.post(`/p2p/rooms/${roomId}/share`, {
    data: { resource_id: resourceId },
  });
  if (!res.ok()) throw new Error(`shareResource failed: ${res.status()}`);
  return res.json();
}

export async function revokeResource(roomId: string, resourceId: number) {
  const c = await ctx();
  const res = await c.delete(`/p2p/rooms/${roomId}/share/${resourceId}`);
  if (!res.ok()) throw new Error(`revokeResource failed: ${res.status()}`);
  return res.json();
}

export async function seedResources(
  count: number,
  plugin = "ebook",
): Promise<Array<{ id: number; name: string }>> {
  const results: Array<{ id: number; name: string }> = [];
  for (let i = 1; i <= count; i++) {
    const r = await createResource({
      name: `seed-${plugin}-${String(i).padStart(3, "0")}`,
      plugin,
      locations: [`file:///test/${plugin}/${i}`],
    });
    results.push({ id: r.id, name: r.name });
  }
  return results;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const c = await ctx();
    const res = await c.get("/health");
    return res.ok();
  } catch {
    return false;
  }
}
