import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { resourcesApi } from "@/api/index.ts";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import { Badge } from "@/components/ui/Badge.tsx";
import { EbookViewer } from "@/components/plugin/EbookViewer.tsx";
import { AudioPlayer } from "@/components/plugin/AudioPlayer.tsx";
import { VideoPlayer } from "@/components/plugin/VideoPlayer.tsx";
import { ProgressPanel } from "@/components/resource/ProgressPanel.tsx";
import type { PluginName } from "@/types/index.ts";

export function ResourceDetailPage() {
  const { plugin, id } = useParams<{ plugin: PluginName; id: string }>();
  const resourceId = Number(id);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => resourcesApi.get(resourceId),
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", plugin, resourceId],
    queryFn: () => resourcesApi.getProgress(plugin!, resourceId),
    enabled: !!plugin && !!resourceId,
  });

  if (isLoading) return <LoadingScreen />;
  if (!resource) return <div className="text-red-400">Resource not found.</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{resource.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge label={resource.plugin} color="purple" />
            <Badge label={resource.type} color="gray" />
          </div>
        </div>
      </div>

      {/* Inline viewer per plugin type */}
      {plugin === "ebook" && resource.locations?.[0] && (
        <EbookViewer url={`/api/resources/ebook/${resourceId}/stream`} />
      )}
      {plugin === "music" && (
        <AudioPlayer src={`/api/resources/music/${resourceId}/stream`} name={resource.name} />
      )}
      {plugin === "video" && (
        <VideoPlayer src={`/api/resources/video/${resourceId}/stream`} name={resource.name} />
      )}
      {plugin === "game" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 text-sm text-gray-400">
          <p className="mb-2">Game resources can be streamed via Moonlight on desktop.</p>
          <p className="text-xs text-gray-600">(Moonlight launch requires the desktop app.)</p>
        </div>
      )}
      {plugin === "pic" && resource.locations?.[0] && (
        <img
          src={`/api/resources/pic/${resourceId}/stream`}
          alt={resource.name}
          className="max-w-full rounded-xl border border-gray-800 mb-4"
        />
      )}
      {plugin === "online_viewer" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 text-sm text-gray-400">
          <p>Online viewer resources open in an embedded WebView in the desktop app.</p>
        </div>
      )}

      {/* Locations */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">Locations</h2>
        <ul className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
          {resource.locations?.map((loc) => (
            <li key={loc} className="px-4 py-2 text-xs text-gray-300 font-mono">{loc}</li>
          ))}
          {!resource.locations?.length && (
            <li className="px-4 py-2 text-xs text-gray-600">No locations recorded.</li>
          )}
        </ul>
      </section>

      {/* Progress */}
      {["ebook", "music", "video"].includes(plugin ?? "") && (
        <ProgressPanel plugin={plugin!} resourceId={resourceId} records={progress ?? []} />
      )}
    </div>
  );
}
