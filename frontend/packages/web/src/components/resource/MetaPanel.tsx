import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { seriesApi } from "@/api/series.ts";
import { Input } from "@/components/ui/Input.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { PLUGIN_META_FIELDS } from "@/utils/pluginMeta.ts";

interface MetaPanelProps {
  plugin: string;
  resourceId: number;
}

export function MetaPanel({ plugin, resourceId }: MetaPanelProps) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const fields = PLUGIN_META_FIELDS[plugin] ?? [];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta", plugin, resourceId],
    queryFn: () => seriesApi.getMeta(plugin, resourceId),
    enabled: fields.length > 0,
  });

  const save = useMutation({
    mutationFn: () => seriesApi.postMeta(plugin, resourceId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta", plugin, resourceId] });
      setEditing(false);
    },
  });

  if (fields.length === 0) return null;

  function startEdit() {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = meta?.[f.key] != null ? String(meta[f.key]) : "";
    }
    setForm(initial);
    setEditing(true);
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-400">{t("detail.metadata")}</h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs text-purple-400 hover:text-purple-300">
            Edit
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-600">{t("common.loading")}</p>
      ) : editing ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type={f.type ?? "text"}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t("meta.saving") : t("meta.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("form.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="bg-gray-900 rounded-xl border border-gray-800 grid grid-cols-2 gap-px overflow-hidden text-sm">
          {fields.map((f) => {
            const val = meta?.[f.key];
            if (val == null || val === "") return null;
            return (
              <div key={f.key} className="bg-gray-900 px-4 py-2">
                <dt className="text-xs text-gray-500">{f.label}</dt>
                <dd className="text-gray-200 mt-0.5">{String(val)}</dd>
              </div>
            );
          })}
          {!meta || Object.keys(meta).every((k) => meta[k] == null) ? (
            <div className="col-span-2 px-4 py-3 text-xs text-gray-600">
              No metadata yet.{" "}
              <button onClick={startEdit} className="text-purple-400 hover:underline">
                Add now
              </button>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
