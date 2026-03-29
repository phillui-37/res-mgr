import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { http } from "@/api/client.ts";
import { p2pApi } from "@/api/p2p.ts";

const mock = new MockAdapter(http);

beforeEach(() => mock.reset());

describe("p2pApi", () => {
  describe("listRooms()", () => {
    it("GETs /p2p/rooms", async () => {
      mock.onGet("/p2p/rooms").reply(200, [
        { room_id: "room-1", peer_count: 2 },
        { room_id: "room-2", peer_count: 0 },
      ]);

      const rooms = await p2pApi.listRooms();
      expect(rooms).toHaveLength(2);
      expect(rooms[0].room_id).toBe("room-1");
      expect(rooms[0].peer_count).toBe(2);
    });

    it("returns empty array when no rooms", async () => {
      mock.onGet("/p2p/rooms").reply(200, []);
      expect(await p2pApi.listRooms()).toEqual([]);
    });
  });

  describe("createRoom()", () => {
    it("POSTs to /p2p/rooms with a specific room_id", async () => {
      mock.onPost("/p2p/rooms").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.room_id).toBe("my-room");
        return [200, { room_id: "my-room", ws_url: "/ws/p2p?room=my-room" }];
      });

      const result = await p2pApi.createRoom("my-room");
      expect(result.room_id).toBe("my-room");
      expect(result.ws_url).toContain("my-room");
    });

    it("POSTs without room_id when none provided", async () => {
      mock.onPost("/p2p/rooms").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.room_id).toBeUndefined();
        return [200, { room_id: "auto-uuid", ws_url: "/ws/p2p?room=auto-uuid" }];
      });

      const result = await p2pApi.createRoom();
      expect(result.room_id).toBe("auto-uuid");
    });
  });

  describe("getRoom()", () => {
    it("GETs /p2p/rooms/:roomId", async () => {
      mock.onGet("/p2p/rooms/room-1").reply(200, {
        room_id: "room-1", peer_count: 3, shared_resources: [1, 2],
      });

      const room = await p2pApi.getRoom("room-1");
      expect(room.peer_count).toBe(3);
      expect(room.shared_resources).toEqual([1, 2]);
    });

    it("rejects on 404", async () => {
      mock.onGet("/p2p/rooms/ghost").reply(404, { error: "Room not found" });
      await expect(p2pApi.getRoom("ghost")).rejects.toThrow();
    });
  });

  describe("shareResource()", () => {
    it("POSTs to /p2p/rooms/:roomId/share with resource_id", async () => {
      mock.onPost("/p2p/rooms/room-1/share").reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.resource_id).toBe(42);
        return [200, { ok: true, room_id: "room-1" }];
      });

      const result = await p2pApi.shareResource("room-1", 42);
      expect(result.ok).toBe(true);
    });
  });

  describe("revokeResource()", () => {
    it("DELETEs /p2p/rooms/:roomId/share/:resourceId", async () => {
      mock.onDelete("/p2p/rooms/room-1/share/42").reply(200, { ok: true });

      const result = await p2pApi.revokeResource("room-1", 42);
      expect(result.ok).toBe(true);
    });

    it("rejects on 404 for unshared resource", async () => {
      mock.onDelete("/p2p/rooms/room-1/share/999").reply(404, { error: "Not found" });
      await expect(p2pApi.revokeResource("room-1", 999)).rejects.toThrow();
    });
  });
});
