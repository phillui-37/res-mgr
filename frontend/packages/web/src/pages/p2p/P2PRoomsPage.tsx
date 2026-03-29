import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { p2pApi } from "@/api/index.ts";
import { Button } from "@/components/ui/Button.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";

export function P2PRoomsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["p2p", "rooms"],
    queryFn: () => p2pApi.listRooms(),
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: () => p2pApi.createRoom(newRoomId || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["p2p", "rooms"] });
      setCreating(false);
      setNewRoomId("");
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">P2P Rooms</h1>
        <Button onClick={() => setCreating(true)}>+ New Room</Button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Room ID (optional)</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
              placeholder="my-room (leave blank for auto UUID)"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
            />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      <div className="grid gap-3">
        {rooms?.map((room) => (
          <Link
            key={room.room_id}
            to={`/p2p/${room.room_id}`}
            className="bg-gray-900 border border-gray-800 hover:border-purple-700 rounded-xl p-4 flex items-center justify-between transition-colors"
          >
            <div>
              <div className="font-mono text-sm text-gray-100">{room.room_id}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {room.peer_count} peer{room.peer_count !== 1 ? "s" : ""} ·{" "}
                {room.shared_resources.length} shared resource{room.shared_resources.length !== 1 ? "s" : ""}
              </div>
            </div>
            <span className="text-gray-600">→</span>
          </Link>
        ))}
        {!rooms?.length && (
          <div className="text-center py-12 text-gray-600">No active rooms.</div>
        )}
      </div>
    </div>
  );
}
