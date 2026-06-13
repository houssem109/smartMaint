import axios, { AxiosError } from 'axios';
import { getApiBasePath, getApiDisplayLabel, getApiUrl } from './runtime-url';

export { getApiUrl, getApiBasePath, getApiDisplayLabel };

/** @deprecated Prefer getApiUrl() — static env value only valid on PC localhost. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  timeout: 15000,
});

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string | string[] }>;
    if (ax.code === 'ECONNABORTED') {
      return 'Server timeout — is the PC running and on the same Wi‑Fi?';
    }
    if (!ax.response) {
      return `Cannot reach API at ${getApiDisplayLabel()}. Check Wi‑Fi and that Docker is running.`;
    }
    const msg = ax.response.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (ax.response.status === 401) return 'Invalid email or password.';
  }
  return fallback;
}

api.interceptors.request.use((config) => {
  config.baseURL = getApiBasePath();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const reqUrl = String(error?.config?.url || '');
    const isLoginRequest = reqUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
