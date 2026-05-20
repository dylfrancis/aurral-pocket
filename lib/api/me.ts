import { api } from "./client";
import type {
  ChangePasswordPayload,
  ListenHistorySettings,
  UpdateListenHistoryPayload,
} from "@/lib/types/me";

export async function getMyListeningHistory() {
  const r = await api.get<ListenHistorySettings>("/users/me/listening-history");
  return r.data;
}

export async function updateMyListeningHistory(
  userId: number,
  payload: UpdateListenHistoryPayload,
) {
  const r = await api.patch<ListenHistorySettings>(`/users/${userId}`, payload);
  return r.data;
}

export async function changeMyPassword(payload: ChangePasswordPayload) {
  const r = await api.post<{ success: boolean }>("/users/me/password", payload);
  return r.data;
}
