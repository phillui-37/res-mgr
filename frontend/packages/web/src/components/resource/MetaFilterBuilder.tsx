import { useState } from "react";
import { Input } from "@/components/ui/Input.tsx";
import { Button } from "@/components/ui/Button.tsx";

export interface MetaCondition {
  plugin: string;
  field: string;
  value: string;
}

interface FieldDef {
  plugin: string;
  pluginLabel: string;
  field: string;
  label: string;
}

const ALL_FIELDS: FieldDef[] = [
  // ebook
  { plugin: "ebook", pluginLabel: "Ebook", field: "author",         label: "Author" },
  { plugin: "ebook", pluginLabel: "Ebook", field: "illustrator",    label: "Illustrator" },
  { plugin: "ebook", pluginLabel: "Ebook", field: "publisher",      label: "Publisher" },
  { plugin: "ebook", pluginLabel: "Ebook", field: "genre",          label: "Genre" },
  { plugin: "ebook", pluginLabel: "Ebook", field: "description",    label: "Description" },
  { plugin: "ebook", pluginLabel: "Ebook", field: "isbn",           label: "ISBN" },
  // music
  { plugin: "music", pluginLabel: "Music", field: "artist",         label: "Artist" },
  { plugin: "music", pluginLabel: "Music", field: "album_artist",   label: "Album Artist" },
  { plugin: "music", pluginLabel: "Music", field: "album",          label: "Album" },
  { plugin: "music", pluginLabel: "Music", field: "genre",          label: "Genre" },
  { plugin: "music", pluginLabel: "Music", field: "composer",       label: "Composer" },
  { plugin: "music", pluginLabel: "Music", field: "label",          label: "Label" },
  { plugin: "music", pluginLabel: "Music", field: "isrc",           label: "ISRC" },
  // video
  { plugin: "video", pluginLabel: "Video", field: "director",       label: "Director" },
  { plugin: "video", pluginLabel: "Video", field: "studio",         label: "Studio" },
  { plugin: "video", pluginLabel: "Video", field: "genre",          label: "Genre" },
  { plugin: "video", pluginLabel: "Video", field: "description",    label: "Description" },
  { plugin: "video", pluginLabel: "Video", field: "resolution",     label: "Resolution" },
  { plugin: "video", pluginLabel: "Video", field: "video_codec",    label: "Video Codec" },
  { plugin: "video", pluginLabel: "Video", field: "audio_codec",    label: "Audio Codec" },
  // game
  { plugin: "game",  pluginLabel: "Game",  field: "developer",      label: "Developer" },
  { plugin: "game",  pluginLabel: "Game",  field: "publisher",      label: "Publisher" },
  { plugin: "game",  pluginLabel: "Game",  field: "genre",          label: "Genre" },
  { plugin: "game",  pluginLabel: "Game",  field: "description",    label: "Description" },
  { plugin: "game",  pluginLabel: "Game",  field: "steam_app_id",   label: "Steam App ID" },
  { plugin: "game",  pluginLabel: "Game",  field: "dlsite_id",      label: "DLSite ID" },
  // pic
  { plugin: "pic",   pluginLabel: "Pic",   field: "creator",        label: "Creator" },
  { plugin: "pic",   pluginLabel: "Pic",   field: "circle",         label: "Circle" },
  { plugin: "pic",   pluginLabel: "Pic",   field: "event",          label: "Event" },
  { plugin: "pic",   pluginLabel: "Pic",   field: "series_title",   label: "Series Title" },
  // online_viewer
  { plugin: "online_viewer", pluginLabel: "Online Viewer", field: "title",        label: "Title" },
  { plugin: "online_viewer", pluginLabel: "Online Viewer", field: "description",  label: "Description" },
  { plugin: "online_viewer", pluginLabel: "Online Viewer", field: "original_url", label: "Original URL" },
];

interface MetaFilterBuilderProps {
  conditions: MetaCondition[];
  onChange: (conds: MetaCondition[]) => void;
}

export function MetaFilterBuilder({ conditions, onChange }: MetaFilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldDef | null>(null);
  const [valueInput, setValueInput] = useState("");

  function addCondition() {
    if (!selectedField || !valueInput.trim()) return;
    const next: MetaCondition = {
      plugin: selectedField.plugin,
      field:  selectedField.field,
      value:  valueInput.trim(),
    };
    onChange([...conditions, next]);
    setSelectedField(null);
    setValueInput("");
    setOpen(false);
  }

  function removeCondition(i: number) {
    onChange(conditions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Active condition chips */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conditions.map((c, i) => {
            const def = ALL_FIELDS.find((f) => f.plugin === c.plugin && f.field === c.field);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-900/50 text-indigo-300 text-xs rounded-lg"
              >
                <span className="text-indigo-500">{def?.pluginLabel ?? c.plugin}</span>
                <span>:</span>
                <span>{def?.label ?? c.field}</span>
                <span className="text-indigo-400">≈</span>
                <span className="font-medium">{c.value}</span>
                <button onClick={() => removeCondition(i)} className="ml-1 text-indigo-500 hover:text-red-400">×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Add condition toggle */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="self-start text-xs text-gray-500 hover:text-gray-300 px-2 py-1 border border-dashed border-gray-700 rounded-lg"
        >
          + Add metadata filter
        </button>
      ) : (
        <div className="flex gap-2 items-end flex-wrap border border-gray-800 rounded-xl p-3 bg-gray-900/50">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Field</label>
            <select
              value={selectedField ? `${selectedField.plugin}:${selectedField.field}` : ""}
              onChange={(e) => {
                const [plugin, field] = e.target.value.split(":");
                setSelectedField(ALL_FIELDS.find((f) => f.plugin === plugin && f.field === field) ?? null);
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500 min-w-48"
            >
              <option value="">Select field…</option>
              {["ebook","music","video","game","pic","online_viewer"].map((plugin) => (
                <optgroup key={plugin} label={ALL_FIELDS.find((f) => f.plugin === plugin)?.pluginLabel ?? plugin}>
                  {ALL_FIELDS.filter((f) => f.plugin === plugin).map((f) => (
                    <option key={f.field} value={`${f.plugin}:${f.field}`}>{f.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Input
            label="Contains"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCondition()}
            placeholder="search value…"
            className="w-40"
          />
          <Button size="sm" onClick={addCondition} disabled={!selectedField || !valueInput.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setSelectedField(null); setValueInput(""); }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function conditionsToParams(conds: MetaCondition[]): string[] {
  return conds.map((c) => `${c.plugin}:${c.field}:${c.value}`);
}
