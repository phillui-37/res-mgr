import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StorageIdentity {
  /** Hardware UUID/serial, or a user-defined key for manual entries. */
  id: string;
  /** Human-readable label shown in the picker. */
  name: string;
  /** True when the id was obtained from the OS (vs manually typed). */
  isHardware: boolean;
}

interface DeviceState {
  deviceName: string | null;
  setDeviceName: (name: string | null) => void;
  /** Saved portable storage identities (USB drives, portable SSDs, …). */
  knownStorages: StorageIdentity[];
  addOrUpdateStorage: (id: string, name: string, isHardware?: boolean) => void;
  removeStorage: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      deviceName: null,
      setDeviceName: (name) => set({ deviceName: name }),
      knownStorages: [],
      addOrUpdateStorage: (id, name, isHardware = false) =>
        set((s) => {
          const exists = s.knownStorages.some((st) => st.id === id);
          if (exists) {
            return {
              knownStorages: s.knownStorages.map((st) =>
                st.id === id ? { ...st, name } : st,
              ),
            };
          }
          return { knownStorages: [...s.knownStorages, { id, name, isHardware }] };
        }),
      removeStorage: (id) =>
        set((s) => ({ knownStorages: s.knownStorages.filter((st) => st.id !== id) })),
    }),
    {
      name: "device-store",
      partialize: (s) => ({ deviceName: s.deviceName, knownStorages: s.knownStorages }),
    },
  ),
);
