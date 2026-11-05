import { api } from "./client";
import type {
  ChangePasswordPayload,
  DiscoverLayoutEntry,
  DiscoverLayoutResponse,
  ListenHistorySettings,
  UpdateListenHistoryPayload,
} from "@/lib/types/me";

export async function getMyListeningHistory() {
  const r = await api.get<ListenHistorySettings>("/users/me/listening-history");
  return r.data;
}

export async function updateMyListeningHistory(
  payload: UpdateListenHistoryPayload,
) {
  const r = await api.patch<ListenHistorySettings>(
    "/users/me/listening-history",
    payload,
  );
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

export async function updateMyDiscoverLayout(layout: DiscoverLayoutEntry[]) {
  const r = await api.patch<DiscoverLayoutResponse>(
    "/users/me/discover-layout",
    { layout },
  );
  return r.data;
}
