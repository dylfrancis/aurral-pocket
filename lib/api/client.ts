import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

const api = axios.create({
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

let authToken: string | null = null;

export function setBaseUrl(url: string) {
  api.defaults.baseURL = url ? `${url}/api` : '';
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response) {
      const data = error.response.data;
      const msg = data?.error || data?.message || error.message;
      throw new ApiError(error.response.status, msg, data);
    }
    throw new ApiError(0, 'Unable to reach server. Check your connection.');
  },
);

export { api };
