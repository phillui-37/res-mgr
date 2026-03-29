import { useQuery } from "@tanstack/react-query";
import { resourcesApi, pluginsApi, p2pApi } from "@/api/index.ts";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import { Badge } from "@/components/ui/Badge.tsx";

export function DashboardPage() {
  const resources = useQuery({
    queryKey: ["resources", "count"],
    queryFn: () => resourcesApi.list({ per_page: 1 }),
  });
  const plugins = useQuery({
    queryKey: ["plugins"],
    queryFn: () => pluginsApi.list(),
  });
  const rooms = useQuery({
    queryKey: ["p2p", "rooms"],
    queryFn: () => p2pApi.listRooms(),
  });

  if (resources.isLoading) return <LoadingScreen />;

  const stats = [
    { label: "Total Resources", value: resources.data?.total ?? 0, color: "purple" as const },
    { label: "Plugins Loaded", value: plugins.data?.length ?? 0, color: "blue" as const },
    { label: "Active P2P Rooms", value: rooms.data?.length ?? 0, color: "green" as const },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-3xl font-bold text-gray-100 mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
            <div className="mt-3">
              <Badge label={color} color={color} />
            </div>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Loaded Plugins</h2>
        <div className="grid grid-cols-3 gap-3">
          {plugins.data?.map((p) => (
            <div key={p.name} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="font-medium text-gray-100 mb-2">{p.name}</div>
              <div className="text-xs text-gray-500 mb-2">v{p.version}</div>
              <div className="flex flex-wrap gap-1">
                {p.capabilities.map((cap) => (
                  <Badge key={cap} label={cap} color="purple" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
