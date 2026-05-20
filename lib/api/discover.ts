import { api } from "./client";
import type { Blocklist, UpdateBlocklistResponse } from "@/lib/types/discover";
import { normalizeBlocklist } from "@/lib/blocklist";

export async function getBlocklist(): Promise<Blocklist> {
  const r = await api.get<Blocklist>("/discover/blocklist");
  return normalizeBlocklist(r.data);
}

export async function updateBlocklist(
  blocklist: Blocklist,
): Promise<Blocklist> {
  const r = await api.put<UpdateBlocklistResponse>("/discover/blocklist", {
    artists: blocklist.artists,
    tags: blocklist.tags,
  });
  return normalizeBlocklist(r.data?.blocklist ?? blocklist);
}
