import { api } from "./client";
import type { Request } from "@/lib/types/requests";

export async function getRequests() {
  const r = await api.get<Request[]>("/requests");
  return r.data;
}

export async function deleteAlbumRequest(albumId: string) {
  const r = await api.delete(`/requests/album/${albumId}`);
  return r.data;
}
