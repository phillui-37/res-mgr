import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { p2pApi, resourcesApi } from "@/api/index.ts";
import { Button } from "@/components/ui/Button.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import { Badge } from "@/components/ui/Badge.tsx";

export function P2PRoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const qc = useQueryClient();

  const { data: room, isLoading } = useQuery({
    queryKey: ["p2p", "room", roomId],
    queryFn: () => p2pApi.getRoom(roomId!),
    refetchInterval: 3000,
  });

  const { data: resources } = useQuery({
    queryKey: ["resources", { per_page: 200 }],
    queryFn: () => resourcesApi.list({ per_page: 200 }),
  });

  const share = useMutation({
    mutationFn: (resourceId: number) => p2pApi.shareResource(roomId!, resourceId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p", "room", roomId] }),
  });

  const revoke = useMutation({
    mutationFn: (resourceId: number) => p2pApi.revokeResource(roomId!, resourceId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p", "room", roomId] }),
  });

  if (isLoading) return <LoadingScreen />;
  if (!room) return <div className="text-red-400">Room not found.</div>;

  const sharedIds = new Set(room.shared_resources);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100 font-mono">{room.room_id}</h1>
        <div className="flex gap-3 mt-2 text-sm text-gray-400">
          <span>{room.peer_count} peer{room.peer_count !== 1 ? "s" : ""} connected</span>
          <span>·</span>
          <span>{room.shared_resources.length} shared resource{room.shared_resources.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* WebSocket URL */}
      {room.ws_url && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-6">
          <div className="text-xs text-gray-500 mb-1">WS connection URL</div>
          <code className="text-xs text-green-400 font-mono break-all">{room.ws_url}</code>
        </div>
      )}

      {/* Resource sharing */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Resources</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Plugin</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {resources?.data.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/40">
                  <td className="px-4 py-2 text-gray-200">{r.name}</td>
                  <td className="px-4 py-2"><Badge label={r.plugin} color="purple" /></td>
                  <td className="px-4 py-2">
                    {sharedIds.has(r.id) ? (
                      <Badge label="shared" color="green" />
                    ) : (
                      <Badge label="not shared" color="gray" />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {sharedIds.has(r.id) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => revoke.mutate(r.id)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => share.mutate(r.id)}
                        disabled={share.isPending}
                      >
                        Share
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
