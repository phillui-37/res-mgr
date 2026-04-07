import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.ts";
import { useDeviceStore } from "@/store/device.ts";
import { http } from "@/api/client.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export function SettingsPage() {
  const { jwt, apiUrl, setJwt, setApiUrl, logout } = useAuthStore();
  const { deviceName, setDeviceName, knownStorages, removeStorage } = useDeviceStore();
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState(jwt ?? "");
  const [url, setUrl] = useState(apiUrl);
  const [saved, setSaved] = useState(false);
  const [deviceInput, setDeviceInput] = useState(deviceName ?? "");
  const [deviceStatus, setDeviceStatus] = useState<"idle" | "saved" | "confirm" | "error">("idle");

  function save() {
    setJwt(token);
    setApiUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveDevice() {
    const name = deviceInput.trim();
    if (!name) return;
    setDeviceStatus("idle");
    try {
      const res = await http.post<{ id: number; name: string }>("/devices", { name });
      if (res.status === 201) {
        setDeviceName(name);
        setDeviceStatus("saved");
        setTimeout(() => setDeviceStatus("idle"), 2000);
      } else {
        setDeviceStatus("confirm");
      }
    } catch {
      setDeviceStatus("error");
    }
  }

  function confirmReclaim() {
    setDeviceName(deviceInput.trim());
    setDeviceStatus("saved");
    setTimeout(() => setDeviceStatus("idle"), 2000);
  }

  function changeLang(lang: string) {
    void i18n.changeLanguage(lang);
    localStorage.setItem("i18n_lang", lang);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">{t("settings.title")}</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 mb-6">
        <Input
          id="api-url"
          label={t("settings.apiUrl")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
        />
        <Input
          id="jwt-token"
          label={t("settings.jwtToken")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGci…"
          type="password"
        />
        <div className="flex gap-2 mt-2">
          <Button onClick={save}>{saved ? t("settings.saved") : t("settings.save")}</Button>
          <Button variant="danger" onClick={logout}>{t("settings.logout")}</Button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-300">{t("settings.deviceIdentity")}</h2>
        <p className="text-xs text-gray-500">
          {t("settings.deviceHint")}
          {deviceName && (
            <span className="ml-1 text-purple-400">{t("settings.deviceCurrent")}<strong>{deviceName}</strong></span>
          )}
        </p>
        <Input
          id="device-name"
          label={t("settings.deviceName")}
          value={deviceInput}
          onChange={(e) => { setDeviceInput(e.target.value); setDeviceStatus("idle"); }}
          placeholder={t("settings.devicePlaceholder")}
        />
        {deviceStatus === "error" && (
          <p className="text-red-400 text-xs">{t("settings.registerError")}</p>
        )}
        {deviceStatus === "confirm" && (
          <div className="flex flex-col gap-2">
            <p className="text-yellow-400 text-xs">
              {t("settings.reclaim.prompt", { name: deviceInput.trim() })}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmReclaim}>{t("settings.reclaim.confirm")}</Button>
              <Button size="sm" variant="secondary" onClick={() => setDeviceStatus("idle")}>{t("settings.reclaim.cancel")}</Button>
            </div>
          </div>
        )}
        {deviceStatus !== "confirm" && (
          <Button onClick={saveDevice} disabled={!deviceInput.trim()}>
            {deviceStatus === "saved" ? t("settings.registered") : t("settings.registerDevice")}
          </Button>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-300">{t("settings.storageIdentities")}</h2>
        <p className="text-xs text-gray-500">{t("settings.storageHint")}</p>
        {knownStorages.length === 0 ? (
          <p className="text-xs text-gray-600 italic">{t("settings.noStorages")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {knownStorages.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate font-mono">{s.id}</p>
                </div>
                {s.isHardware && (
                  <span className="text-xs text-blue-400 shrink-0">HW</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => removeStorage(s.id)}
                >
                  {t("settings.removeStorage")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-300">{t("settings.language")}</h2>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                i18n.language === lang.code
                  ? "border-purple-500 bg-purple-900/40 text-purple-200"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-600">
        <p>{t("settings.jwtHint")}</p>
        <p className="mt-1">{t("settings.jwtHint2")}</p>
      </div>
    </div>
  );
}
