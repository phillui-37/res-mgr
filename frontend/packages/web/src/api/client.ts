import axios from "axios";

// Base URL priority: localStorage override → Electron preload → env var → Vite proxy path.
const BASE_URL =
  localStorage.getItem("apiUrl") ||
  window.electron?.apiUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api";

export const http = axios.create({ baseURL: BASE_URL });

// Inject JWT — in Electron the preload devJwt takes priority over localStorage
// so a stale/wrong value in localStorage can't override the .env token.
http.interceptors.request.use((config) => {
  const token = window.electron?.devJwt || localStorage.getItem("jwt");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to /settings on 401 (use hash path for Electron file:// compatibility).
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = window.electron?.isElectron
        ? "#/settings"
        : "/settings";
    }
    return Promise.reject(err);
  },
);
