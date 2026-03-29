import axios from "axios";

// Base URL: prefer persisted apiUrl, then env var, then default proxy path.
const BASE_URL =
  localStorage.getItem("apiUrl") ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api";

export const http = axios.create({ baseURL: BASE_URL });

// Inject JWT from localStorage on every request.
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to /settings on 401.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = "/settings";
    }
    return Promise.reject(err);
  },
);
