import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { http } from "@/api/client.ts";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import { Badge } from "@/components/ui/Badge.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { AudioPlayer } from "@/components/plugin/AudioPlayer.tsx";
import { VideoPlayer } from "@/components/plugin/VideoPlayer.tsx";
import { ProgressPanel } from "@/components/resource/ProgressPanel.tsx";
import { MetaPanel } from "@/components/resource/MetaPanel.tsx";
import type { PluginName } from "@/types/index.ts";

function EbookCover({ resourceId, hasLocation }: { resourceId: number; hasLocation: boolean }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasLocation) return;
    let objectUrl: string | null = null;
    http.get<ArrayBuffer>(`${http.defaults.baseURL}/resources/ebook/${resourceId}/cover`, { responseType: "arraybuffer" })
      .then(({ data, headers }) => {
        const mime = (headers["content-type"] as string) || "image/jpeg";
        const blob = new Blob([data], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [resourceId, hasLocation]);

  if (!hasLocation || failed) {
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 mb-4 h-48 text-gray-500 text-sm">
        {t("detail.previewNotAvailable")}
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 mb-4 h-48 text-gray-400 text-sm animate-pulse">
        {t("detail.loadingCover")}
      </div>
    );
  }

  return (
    <div className="mb-4 flex justify-center">
      <img
        src={src}
        alt="Cover"
        className="max-h-96 rounded-xl border border-gray-800 shadow-lg object-contain"
      />
    </div>
  );
}

export function ResourceDetailPage() {
  const { plugin, id } = useParams<{ plugin: PluginName; id: string }>();
  const resourceId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => resourcesApi.get(resourceId),
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", plugin, resourceId],
    queryFn: () => resourcesApi.getProgress(plugin!, resourceId),
    enabled: !!plugin && !!resourceId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => resourcesApi.remove(resourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      navigate(-1);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (!resource) return <div className="text-red-400">{t("detail.notFound")}</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{resource.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge label={resource.plugin} color="purple" />
            <Badge label={resource.type} color="gray" />
            {resource.language && (
              <Badge label={resource.language} color="blue" data-testid="resource-language" />
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-red-500 hover:text-red-400 shrink-0"
          onClick={() => { if (confirm(t("detail.confirmDelete"))) deleteMutation.mutate(); }}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? t("detail.deleting") : t("detail.delete")}
        </Button>
      </div>

      {/* Inline viewer per plugin type */}
      {plugin === "ebook" && (
        <EbookCover resourceId={resourceId} hasLocation={!!resource.locations?.[0]} />
      )}
      {plugin === "music" && (
        <AudioPlayer src={`${http.defaults.baseURL}/resources/music/${resourceId}/stream`} name={resource.name} />
      )}
      {plugin === "video" && (
        <VideoPlayer src={`${http.defaults.baseURL}/resources/video/${resourceId}/stream`} name={resource.name} />
      )}
      {plugin === "game" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 text-sm text-gray-400">
          <p className="mb-2">Game resources can be streamed via Moonlight on desktop.</p>
          <p className="text-xs text-gray-600">(Moonlight launch requires the desktop app.)</p>
        </div>
      )}
      {plugin === "pic" && resource.locations?.[0] && (
        <img
          src={`${http.defaults.baseURL}/resources/pic/${resourceId}/stream`}
          alt={resource.name}
          className="max-w-full rounded-xl border border-gray-800 mb-4"
        />
      )}
      {plugin === "online_viewer" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 text-sm text-gray-400">
          <p>Online viewer resources open in an embedded WebView in the desktop app.</p>
        </div>
      )}

      {/* Extended metadata */}
      {plugin && <MetaPanel plugin={plugin} resourceId={resourceId} />}

      {/* Locations */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">{t("detail.locations")}</h2>
        <ul className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
          {resource.locations?.map((loc) => (
            <li key={`${loc.device}:${loc.path}`} className="px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-medium bg-gray-800 text-purple-400 border border-purple-900 rounded px-1.5 py-0.5 shrink-0">
                {loc.device}
              </span>
              <span className="text-xs text-gray-300 font-mono truncate">{loc.path}</span>
            </li>
          ))}
          {!resource.locations?.length && (
            <li className="px-4 py-2 text-xs text-gray-600">{t("detail.noLocations")}</li>
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
