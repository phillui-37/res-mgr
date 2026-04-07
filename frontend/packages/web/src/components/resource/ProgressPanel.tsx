import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { Button } from "@/components/ui/Button.tsx";
import type { ProgressRecord } from "@/types/index.ts";

interface ProgressPanelProps {
  plugin: string;
  resourceId: number;
  records: ProgressRecord[];
}

export function ProgressPanel({ plugin, resourceId, records }: ProgressPanelProps) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  const save = useMutation({
    mutationFn: (data: Partial<ProgressRecord>) =>
      resourcesApi.saveProgress(plugin, resourceId, data),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["progress", plugin, resourceId] }),
  });

  const latest = records[records.length - 1];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-400">{t("detail.progress")}</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            save.mutate({
              device: navigator.userAgent.slice(0, 50),
              percentage: latest?.percentage,
            })
          }
          disabled={save.isPending}
        >
          {t("progress.saveCurrent")}
        </Button>
      </div>

      {latest ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="h-2 rounded-full bg-purple-600"
              style={{ width: `${latest.percentage ?? 0}%`, maxWidth: "100%" }}
            />
            <span className="text-gray-400 text-xs">{latest.percentage?.toFixed(1)}%</span>
          </div>
          {latest.current_page && (
            <div className="text-gray-500 text-xs">
              {t("progress.page", { current: latest.current_page, total: latest.total_pages })}
            </div>
          )}
          {latest.position_ms != null && (
            <div className="text-gray-500 text-xs">
              {Math.floor(latest.position_ms / 60000)}:{String(Math.floor((latest.position_ms / 1000) % 60)).padStart(2, "0")} / {Math.floor((latest.duration_ms ?? 0) / 60000)}:{String(Math.floor(((latest.duration_ms ?? 0) / 1000) % 60)).padStart(2, "0")}
            </div>
          )}
          <div className="text-gray-600 text-xs mt-1">{t("progress.device", { name: latest.device })}</div>
        </div>
      ) : (
        <div className="text-gray-600 text-xs py-3">{t("progress.none")}</div>
      )}
    </section>
  );
}
