import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { resourcesApi } from "@/api/index.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import type { PluginName } from "@/types/index.ts";

const PLUGINS: PluginName[] = ["ebook", "music", "video", "game", "pic", "online_viewer"];

export function ResourceFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [plugin, setPlugin] = useState<PluginName>("ebook");
  const [location, setLocation] = useState("");

  const create = useMutation({
    mutationFn: () =>
      resourcesApi.create({
        name,
        plugin,
        type: plugin,
        locations: location ? [location] : [],
      }),
    onSuccess: (r) => navigate(`/resources/${r.plugin}/${r.id}`),
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-100 mb-6">Add Resource</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Input id="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />

        <div className="flex flex-col gap-1">
          <label htmlFor="plugin" className="text-xs text-gray-400">Plugin</label>
          <select
            id="plugin"
            value={plugin}
            onChange={(e) => setPlugin(e.target.value as PluginName)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
          >
            {PLUGINS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <Input
          id="location"
          label="Location (optional)"
          placeholder="/mnt/nas/books/example.epub"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        {create.isError && (
          <p className="text-red-400 text-sm">
            {(create.error as Error)?.message ?? "Failed to create resource."}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <Button type="submit" disabled={create.isPending || !name}>
            {create.isPending ? "Saving…" : "Create"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
