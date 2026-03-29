import { useState } from "react";
import { useAuthStore } from "@/store/auth.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";

export function SettingsPage() {
  const { jwt, apiUrl, setJwt, setApiUrl, logout } = useAuthStore();
  const [token, setToken] = useState(jwt ?? "");
  const [url, setUrl] = useState(apiUrl);
  const [saved, setSaved] = useState(false);

  function save() {
    setJwt(token);
    setApiUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Settings</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4">
        <Input
          id="api-url"
          label="Backend API URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:9292"
        />
        <Input
          id="jwt-token"
          label="JWT Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGci…"
          type="password"
        />

        <div className="flex gap-2 mt-2">
          <Button onClick={save}>{saved ? "Saved ✓" : "Save"}</Button>
          <Button variant="danger" onClick={logout}>Log out</Button>
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-600">
        <p>The JWT token is stored in <code className="text-gray-500">localStorage</code>.</p>
        <p className="mt-1">To generate a token, use your backend's <code className="text-gray-500">GET /health</code> endpoint or a JWT tool.</p>
      </div>
    </div>
  );
}
