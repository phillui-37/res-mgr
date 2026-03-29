import { http } from "./client.ts";
import type { P2PRoom } from "@/types/index.ts";

export const p2pApi = {
  listRooms() {
    return http.get<P2PRoom[]>("/p2p/rooms").then((r) => r.data);
  },

  createRoom(roomId?: string) {
    return http
      .post<{ room_id: string; ws_url: string }>("/p2p/rooms", { room_id: roomId })
      .then((r) => r.data);
  },

  getRoom(roomId: string) {
    return http.get<P2PRoom>(`/p2p/rooms/${roomId}`).then((r) => r.data);
  },

  shareResource(roomId: string, resourceId: number) {
    return http
      .post<{ ok: boolean; room_id: string }>(`/p2p/rooms/${roomId}/share`, {
        resource_id: resourceId,
      })
      .then((r) => r.data);
  },

  revokeResource(roomId: string, resourceId: number) {
    return http
      .delete<{ ok: boolean }>(`/p2p/rooms/${roomId}/share/${resourceId}`)
      .then((r) => r.data);
  },
};
