import { api } from "./client";
import type { ScrobbleProvider, ScrobbleStatus } from "@/lib/types/scrobbling";

// Each call names its path in full: the API contract check reads the paths
// from this file, and a `${provider}` segment would be probed as a stand-in id.

export async function getScrobbleStatus() {
  const r = await api.get<ScrobbleStatus>("/scrobbling/status");
  return r.data;
}

export type TokenScrobbler = Exclude<ScrobbleProvider, "lastfm">;

/** Koito's link uses the Koito URL saved in the account's listening history. */
export async function linkScrobbler(provider: TokenScrobbler, token: string) {
  const r =
    provider === "listenbrainz"
      ? await api.put<ScrobbleLink>("/scrobbling/listenbrainz/link", { token })
      : await api.put<ScrobbleLink>("/scrobbling/koito/link", { token });
  return r.data;
}

export async function unlinkScrobbler(provider: ScrobbleProvider) {
  if (provider === "lastfm") await api.delete("/scrobbling/lastfm/link");
  else if (provider === "listenbrainz")
    await api.delete("/scrobbling/listenbrainz/link");
  else await api.delete("/scrobbling/koito/link");
}

type ScrobbleLink = { connected: true; displayName: string | null };
