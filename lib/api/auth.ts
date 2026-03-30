import { api } from './client';
import type { LoginRequest, LoginResponse, MeResponse } from '@/lib/types';

export function login(creds: LoginRequest) {
  return api.post<LoginResponse>('/auth/login', creds).then((r) => r.data);
}

export function getMe() {
  return api.get<MeResponse>('/auth/me').then((r) => r.data);
}

export function logout() {
  return api.post('/auth/logout').then((r) => r.data);
}
