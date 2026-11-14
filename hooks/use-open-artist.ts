import { useCallback } from "react";
import { useRouter } from "expo-router";

type ArtistTarget = {
  mbid: string | null | undefined;
  name?: string;
  /** The cover the list showed, so the page opens on the same artwork. */
  coverUrl?: string | null;
};

/**
 * Opens an artist page in the current tab, since a bare path resolves inside
 * the tab's own group. Does nothing without an MBID.
 */
export function useOpenArtist() {
  const router = useRouter();
  return useCallback(
    ({ mbid, name, coverUrl }: ArtistTarget) => {
      if (!mbid) return;
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid, name: name ?? "", ...(coverUrl ? { coverUrl } : {}) },
      });
    },
    [router],
  );
}
