import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { invalidateLibraryLists } from "@/hooks/library/library-lists";
import { invalidateEditionReads } from "@/hooks/library/use-album-editions";
import { formatReleaseWait } from "@/lib/album-status";
import { ApiError } from "@/lib/api/client";
import {
  addLibraryAlbum,
  getLibraryArtistId,
  requestAlbumFromSearch,
} from "@/lib/api/library";
import { libraryAlbumsRef } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "You don't have permission to add albums.";
    }
    return error.message || "Failed to add album.";
  }
  return "Failed to add album.";
}

/**
 * Adds an album the Library lacks, as its release page and its sheet offer
 * it. An artist outside the Library comes in with it.
 */
export function useAddAlbum({
  mbid,
  title,
  artistName,
  artistMbid,
  artistId,
  releaseMbid,
}: {
  /** The release group. */
  mbid: string;
  title: string;
  artistName: string;
  artistMbid: string | null | undefined;
  /** The Library artist's id, when the caller has it. */
  artistId: string | null | undefined;
  /** An edition to add, picked on the release page. */
  releaseMbid?: string | null;
}) {
  const queryClient = useQueryClient();

  // Search knows the artist only by MBID, so the library artist id it needs
  // to add an album is looked up here. An artist page passes its own.
  const needsArtistLookup = !artistId && !!artistMbid;
  const artistIdQuery = {
    queryKey: libraryKeys.artistId(artistMbid ?? ""),
    queryFn: () => getLibraryArtistId(artistMbid!),
  };
  const { data: lookedUpArtistId, isLoading: artistIdLoading } = useQuery({
    ...artistIdQuery,
    enabled: needsArtistLookup,
  });
  const libraryArtistId = artistId || lookedUpArtistId || null;

  const mutation = useMutation({
    mutationFn: async () => {
      // A tap can land before the lookup answers. Wait for it, so an artist
      // already in the library is not sent down the new-artist path.
      const knownArtistId =
        libraryArtistId ||
        (needsArtistLookup
          ? await queryClient.fetchQuery(artistIdQuery)
          : null);
      // Only a request can name an edition, so one goes that way.
      if (knownArtistId && !releaseMbid) {
        const added = await addLibraryAlbum(knownArtistId, mbid, title);
        return { createdArtist: false, albumStatus: added.albumStatus };
      }
      if (!artistMbid) {
        throw new Error("Cannot add album without an artist reference");
      }
      const requested = await requestAlbumFromSearch({
        albumMbid: mbid,
        albumName: title,
        artistMbid,
        artistName,
        releaseMbid: releaseMbid ?? undefined,
      });
      return {
        createdArtist: !!requested.createdArtist,
        albumStatus: requested.albumStatus,
      };
    },
    onSuccess: ({ createdArtist, albumStatus }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateLibraryLists(queryClient);
      // The album now has a Library edition.
      void invalidateEditionReads(queryClient, mbid);
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
      const artistRef = libraryAlbumsRef({
        artistId: libraryArtistId ?? undefined,
        artistMbid: artistMbid ?? undefined,
      });
      if (artistRef) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.albums(artistRef),
        });
      }
      // The date goes in the title, since Android shows only the title.
      if (albumStatus?.status === "unreleased") {
        Burnt.toast({
          title: formatReleaseWait(albumStatus.releaseDate),
          message: `${title} isn't out yet`,
          preset: "done",
        });
        return;
      }
      Burnt.toast({
        title: createdArtist ? `Added ${artistName}` : "Added to library",
        message: createdArtist ? "Now in your library" : title,
        preset: "done",
      });
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: "Couldn't add album",
        message: describeError(error),
        preset: "error",
      });
    },
  });
  const { mutate } = mutation;

  const add = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutate();
  }, [mutate]);

  return {
    add,
    isPending: mutation.isPending,
    isAdded: mutation.isSuccess,
    /** Null until known; with none, the artist is added with the album. */
    libraryArtistId,
    artistIdLoading,
  };
}
