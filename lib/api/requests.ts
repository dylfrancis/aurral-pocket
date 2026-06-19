import { api } from "./client";
import type { Request } from "@/lib/types/requests";

export async function getRequests() {
  // The backend merges album requests with a mixed activity feed
  // (type: "activity"). Keep only album items, which match the Request shape.
  const r = await api.get<(Request | { type?: string })[]>("/requests");
  return r.data.filter((item): item is Request => item?.type === "album");
}

export async function deleteAlbumRequest(albumId: string) {
  const r = await api.delete(`/requests/album/${albumId}`);
  return r.data;
}
