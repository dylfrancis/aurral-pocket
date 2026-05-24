import { api } from "./client";
import type {
  ChangePasswordPayload,
  DiscoverLayoutResponse,
  DiscoverSection,
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

export async function getMyDiscoverLayout() {
  const r = await api.get<DiscoverLayoutResponse>("/users/me/discover-layout");
  return r.data;
}

export async function updateMyDiscoverLayout(layout: DiscoverSection[]) {
  const r = await api.patch<DiscoverLayoutResponse>(
    "/users/me/discover-layout",
    { layout },
  );
  return r.data;
}
