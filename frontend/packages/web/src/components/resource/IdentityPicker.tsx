import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDeviceStore } from "@/store/device.ts";
import { Input } from "@/components/ui/Input.tsx";
import { Button } from "@/components/ui/Button.tsx";

const CUSTOM_SENTINEL = "__custom__";

interface Props {
  /** Visible label above the selector. */
  label: string;
  /** Currently selected identity string (device name, storage id, or custom value). */
  value: string;
  /** Called whenever the effective identity changes. */
  onChange: (v: string) => void;
  /**
   * Hardware volume ID detected from the currently selected path.
   * When this changes the picker auto-selects a matching saved storage,
   * or prompts the user to save a new one.
   */
  detectedHwId?: string | null;
}

export function IdentityPicker({ label, value, onChange, detectedHwId }: Props) {
  const { t } = useTranslation();
  const { deviceName, knownStorages, addOrUpdateStorage } = useDeviceStore();
  const deviceValue = deviceName ?? "unknown";

  const knownIds = useMemo(
    () => new Set([deviceValue, ...knownStorages.map((s) => s.id)]),
    [deviceValue, knownStorages],
  );

  // Track whether the user explicitly chose "Custom…"
  const [customMode, setCustomMode] = useState(() => !!value && !knownIds.has(value));

  // Hardware-detected ID that isn't saved yet — offer to name & save it
  const [offerHwId, setOfferHwId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");

  // When a new hardware ID is detected from the path:
  useEffect(() => {
    if (!detectedHwId) return;
    if (knownIds.has(detectedHwId)) {
      // Already known — auto-select it
      setCustomMode(false);
      onChange(detectedHwId);
      setOfferHwId(null);
    } else {
      // Unknown hardware volume — prompt the user to save it
      setOfferHwId(detectedHwId);
      setSaveName("");
    }
  }, [detectedHwId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectChange(selected: string) {
    setOfferHwId(null);
    if (selected === CUSTOM_SENTINEL) {
      setCustomMode(true);
      onChange("");
    } else {
      setCustomMode(false);
      onChange(selected);
    }
  }

  function handleSave() {
    if (!offerHwId || !saveName.trim()) return;
    addOrUpdateStorage(offerHwId, saveName.trim(), true);
    setCustomMode(false);
    onChange(offerHwId);
    setOfferHwId(null);
  }

  const selectValue = customMode ? CUSTOM_SENTINEL : (knownIds.has(value) ? value : deviceValue);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>
      <select
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
      >
        <option value={deviceValue}>
          {deviceValue} ({t("identity.thisDevice")})
        </option>
        {knownStorages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
        <option value={CUSTOM_SENTINEL}>{t("identity.custom")}</option>
      </select>

      {customMode && (
        <Input
          label={t("identity.customLabel")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("identity.customPlaceholder")}
        />
      )}

      {offerHwId && (
        <div className="flex flex-col gap-2 bg-blue-950/40 border border-blue-800 rounded-lg px-3 py-2 mt-1">
          <p className="text-xs text-blue-300">
            {t("identity.hwDetected", { id: offerHwId })}
          </p>
          <p className="text-xs text-blue-400">{t("identity.hwDetectedHint")}</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label={t("identity.saveName")}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={t("identity.saveNamePlaceholder")}
              />
            </div>
            <Button type="button" size="sm" onClick={handleSave} disabled={!saveName.trim()}>
              {t("identity.save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOfferHwId(null)}>
              {t("identity.dismiss")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
