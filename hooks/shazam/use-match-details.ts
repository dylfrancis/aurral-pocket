import { useQuery } from "@tanstack/react-query";
import { lookupRecordingsByIsrc } from "@/lib/api/musicbrainz";
import {
  resolveStreamingLink,
  searchArtists,
  searchLibraryTracks,
} from "@/lib/api/search";
import { searchKeys, shazamKeys } from "@/lib/query-keys";
import {
  artistSearchQuery,
  findLibraryTrack,
  identifiedArtists,
  librarySearchQuery,
  matchAlbum,
  matchPlaylistTrack,
  pickRecording,
  type MatchAlbum,
  type MatchLookups,
} from "@/lib/shazam/match-details";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type { LibrarySearchTrack, SearchArtist } from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";

const CANDIDATE_LIMIT = 5;

export type MatchDetails = {
  /**
   * The artists credited on the song, or name-search matches when no lookup
   * named one. Empty when the name search found nobody.
   */
  artists: SearchArtist[];
  artistsFromSearch: boolean;
  /** True when the name search failed, rather than found nobody. */
  artistSearchFailed: boolean;
  /** The name the fallback search used. */
  artistQuery: string;
  librarySong: LibrarySearchTrack | null;
  /** The playlist entry for a song the library doesn't have. */
  playlistTrack: SharedPlaylistTrack | null;
  album: MatchAlbum | null;
};

/** React Query keeps a disabled query pending, so one that is off counts as settled. */
function hasSettled(query: { isPending: boolean }, enabled: boolean) {
  return !enabled || !query.isPending;
}

/**
 * Everything the match sheet shows past its header, or null until the
 * lookups behind it have all answered. The sheet then renders once, so no
 * section changes length after it first shows.
 */
export function useMatchDetails(match: ShazamMatch): MatchDetails | null {
  const { isrc, appleMusicUrl } = match;

  const recordingQuery = useQuery({
    queryKey: shazamKeys.recordings(isrc ?? ""),
    queryFn: () => lookupRecordingsByIsrc(isrc!),
    enabled: !!isrc,
    // A recording's credits don't change.
    staleTime: Infinity,
    gcTime: Infinity,
    // Thrown only when MusicBrainz is busy or unreachable.
    retry: 2,
  });

  const linkQuery = useQuery({
    queryKey: shazamKeys.link(appleMusicUrl ?? ""),
    queryFn: () => resolveStreamingLink(appleMusicUrl!),
    enabled: !!appleMusicUrl,
    staleTime: Infinity,
    // A miss can take Aurral several seconds to report; retrying it would
    // hold the sheet for each one.
    retry: false,
  });

  const titleQuery = librarySearchQuery(match);
  const libraryQuery = useQuery({
    queryKey: searchKeys.library(titleQuery),
    queryFn: () => searchLibraryTracks(titleQuery),
    enabled: titleQuery.length > 0,
    // The library changes; the sheet should see it as it is now.
    staleTime: 0,
    // A failure reads as "not in the library", which still offers Add to
    // Playlist; retrying would hold the whole sheet.
    retry: false,
  });

  const lookupsSettled =
    hasSettled(recordingQuery, !!isrc) &&
    hasSettled(linkQuery, !!appleMusicUrl);
  const lookups: MatchLookups = {
    recording: pickRecording(recordingQuery.data ?? [], match),
    link: linkQuery.data ?? null,
  };
  const identified = lookupsSettled ? identifiedArtists(lookups) : null;

  const artistQuery = artistSearchQuery(match);
  const searchEnabled = lookupsSettled && !identified && !!artistQuery;
  const searchQuery = useQuery({
    queryKey: searchKeys.artists(artistQuery),
    queryFn: () => searchArtists(artistQuery),
    enabled: searchEnabled,
  });

  const settled =
    lookupsSettled &&
    hasSettled(libraryQuery, titleQuery.length > 0) &&
    hasSettled(searchQuery, searchEnabled);
  if (!settled) return null;

  const librarySong = findLibraryTrack(libraryQuery.data ?? [], match, lookups);
  return {
    artists:
      identified ?? (searchQuery.data?.artists ?? []).slice(0, CANDIDATE_LIMIT),
    artistsFromSearch: !identified,
    artistSearchFailed: searchQuery.isError,
    artistQuery,
    librarySong,
    playlistTrack: librarySong ? null : matchPlaylistTrack(match, lookups),
    album: matchAlbum(match, lookups, librarySong),
  };
}
