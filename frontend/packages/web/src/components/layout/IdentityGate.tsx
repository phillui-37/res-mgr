import { useState, type ReactNode } from "react";
import { useDeviceStore } from "@/store/device.ts";
import { http } from "@/api/client.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";

type Step = "form" | "confirm";

export function IdentityGate({ children }: { children: ReactNode }) {
  const { deviceName, setDeviceName } = useDeviceStore();
  const [step, setStep] = useState<Step>("form");
  const [nameInput, setNameInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already registered — render app directly
  if (deviceName) return <>{children}</>;

  async function handleSubmit() {
    const name = nameInput.trim();
    if (!name) return;
    setPending(true);
    setError(null);
    try {
      const res = await http.post<{ id: number; name: string }>("/devices", { name });
      if (res.status === 201) {
        setDeviceName(name);
      } else {
        // 200 = already exists; ask for confirmation
        setStep("confirm");
      }
    } catch {
      setError("Could not reach the backend. Check your connection and API settings.");
    } finally {
      setPending(false);
    }
  }

  function handleConfirm() {
    setDeviceName(nameInput.trim());
  }

  function handleCancel() {
    setStep("form");
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100 mb-1">Welcome to ResMgr</h1>
          <p className="text-sm text-gray-400">
            {step === "form"
              ? "Register this device before continuing. Progress records will be attributed to this name."
              : `"${nameInput.trim()}" is already registered on another device.`}
          </p>
        </div>

        {step === "form" ? (
          <>
            <Input
              label="Device Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="my-laptop, living-room-tv…"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <Button onClick={handleSubmit} disabled={!nameInput.trim() || pending}>
              {pending ? "Registering…" : "Register Device"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300">
              Do you want to reclaim this identity for the current device? The previous registration will be reused.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleConfirm}>Yes, Reclaim</Button>
              <Button variant="secondary" onClick={handleCancel}>Use a Different Name</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
