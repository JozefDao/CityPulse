import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { authStore } from './auth-store';
import type { AuthResponse, ErrorResponse } from './types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

const apiOrigin = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://localhost:3001';
  }
})();

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

let refreshPromise: Promise<AuthResponse> | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${apiOrigin}${path}`;
  }

  return `${apiOrigin}/${path}`;
}

function isAuthRoute(url?: string): boolean {
  if (!url) {
    return false;
  }
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

export async function refreshAccessToken(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        authStore.setTokens(
          response.data.accessToken,
          response.data.accessTokenExpiresIn,
        );
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const originalConfig = error.config as RetryConfig | undefined;

    if (!originalConfig) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const shouldHandle401 = status === 401;
    const alreadyRetried = originalConfig._retry === true;
    const skipAuthRefresh = originalConfig._skipAuthRefresh === true;

    if (
      !shouldHandle401 ||
      alreadyRetried ||
      skipAuthRefresh ||
      isAuthRoute(originalConfig.url)
    ) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    try {
      const refreshed = await refreshAccessToken();
      originalConfig.headers = originalConfig.headers ?? {};
      originalConfig.headers.Authorization = `Bearer ${refreshed.accessToken}`;
      return api.request(originalConfig);
    } catch (refreshError) {
      authStore.clear();
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const responseMessage = error.response?.data?.message;
    if (Array.isArray(responseMessage)) {
      return responseMessage.join(', ');
    }
    if (typeof responseMessage === 'string' && responseMessage.length > 0) {
      return responseMessage;
    }
    if (typeof error.message === 'string' && error.message.length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}
