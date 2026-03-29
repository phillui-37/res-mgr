import { test, expect } from "@playwright/test";
import { createRoom } from "../../fixtures/api.ts";
import { connectP2P } from "../../fixtures/ws.ts";

test.describe("WebSocket P2P signaling", () => {
  test("joining a room returns peer list", async () => {
    const room = await createRoom("e2e-ws-signal-room");

    const client = await connectP2P(room.room_id, "peer-1");
    try {
      client.send({ type: "join", room: room.room_id });

      const msg = await client.waitForMessage("joined", 10_000);
      expect(msg.type).toBe("joined");
      expect(msg).toHaveProperty("peer_id");
      expect(msg).toHaveProperty("peers");
      expect(Array.isArray(msg.peers)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("second peer triggers peer_joined event", async () => {
    const room = await createRoom("e2e-ws-peer-join");

    const peer1 = await connectP2P(room.room_id, "peer-a");
    peer1.send({ type: "join", room: room.room_id });
    await peer1.waitForMessage("joined", 10_000);

    const peer2 = await connectP2P(room.room_id, "peer-b");
    peer2.send({ type: "join", room: room.room_id });

    try {
      const msg = await peer1.waitForMessage("peer_joined", 10_000);
      expect(msg.type).toBe("peer_joined");
      expect(msg).toHaveProperty("peer_id");
    } finally {
      await peer1.close();
      await peer2.close();
    }
  });
});
