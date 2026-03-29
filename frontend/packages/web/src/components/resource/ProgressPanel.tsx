import { useMutation, useQueryClient } from "@tanstack/react-query";
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
        <h2 className="text-sm font-semibold text-gray-400">Progress</h2>
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
          Save current
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
              Page {latest.current_page} / {latest.total_pages}
            </div>
          )}
          {latest.position_seconds && (
            <div className="text-gray-500 text-xs">
              {Math.floor(latest.position_seconds / 60)}:{String(Math.floor(latest.position_seconds % 60)).padStart(2, "0")} / {Math.floor((latest.duration_seconds ?? 0) / 60)}:{String(Math.floor((latest.duration_seconds ?? 0) % 60)).padStart(2, "0")}
            </div>
          )}
          <div className="text-gray-600 text-xs mt-1">Device: {latest.device}</div>
        </div>
      ) : (
        <div className="text-gray-600 text-xs py-3">No progress recorded yet.</div>
      )}
    </section>
  );
}
