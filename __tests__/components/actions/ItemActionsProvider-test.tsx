// None unless a test grants some.
const mockPermissions = new Set<string>();
jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => (permission: string) =>
    mockPermissions.has(permission),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  addLibraryAlbum: jest.fn(),
  getCanonicalAlbum: jest.fn(),
  getCanonicalAlbumTracks: jest.fn(),
  getCanonicalArtist: jest.fn(),
  getCanonicalArtistAlbums: jest.fn(),
  getCanonicalLibraryRefresh: jest.fn(),
  getDownloadStatuses: jest.fn(),
  getLibraryArtistId: jest.fn(),
  lookupLibraryAlbums: jest.fn(),
  lookupLibraryArtists: jest.fn(),
  refreshCanonicalLibrary: jest.fn(),
  requestAlbumFromSearch: jest.fn(),
  requestTrackDownload: jest.fn(),
}));

jest.mock("@/lib/api/search", () => ({
  ...jest.requireActual("@/lib/api/search"),
  getEditorialLinks: jest.fn(),
  getEditorialPlaylist: jest.fn(),
}));

jest.mock("@/lib/api/discovery-feedback", () => ({
  addDiscoveryFeedback: jest.fn(),
  deleteDiscoveryFeedback: jest.fn(),
  getDiscoveryFeedback: jest.fn(),
}));

jest.mock("@/lib/api/plugins", () => ({
  getPluginActions: jest.fn(() => Promise.resolve([])),
  runPluginAction: jest.fn(),
}));

jest.mock("@/lib/player/player", () => ({
  ...jest.requireActual("@/lib/player/player"),
  playAlbumFromTrack: jest.fn(() => Promise.resolve(true)),
}));

let mockOffline = false;
jest.mock("@/lib/offline/network", () => ({
  ...jest.requireActual("@/lib/offline/network"),
  isOffline: () => mockOffline,
  useIsOffline: () => mockOffline,
}));

jest.mock("@/lib/offline/saved-library", () => ({
  ...jest.requireActual("@/lib/offline/saved-library"),
  canPlayNow: () => true,
  useSavedStatus: jest.fn(() => null),
}));

// Artwork isn't what these sheets decide.
jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

// The provider sits inside the app's route; these render it alone.
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from "react";
import { Pressable, Text } from "react-native";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import type { AlbumActionsTarget } from "@/components/actions/AlbumActionsSheet";
import type { ArtistActionsTarget } from "@/components/actions/ArtistActionsSheet";
import type { PlaylistActionsTarget } from "@/components/actions/PlaylistActionsSheet";
import { ItemActionsProvider } from "@/components/actions/ItemActionsProvider";
import { useItemActions } from "@/components/actions/item-actions-context";
import { recentReleaseTarget } from "@/components/actions/targets";
import {
  addDiscoveryFeedback,
  deleteDiscoveryFeedback,
  getDiscoveryFeedback,
} from "@/lib/api/discovery-feedback";
import {
  addLibraryAlbum,
  getCanonicalAlbum,
  getCanonicalAlbumTracks,
  getCanonicalArtist,
  getCanonicalArtistAlbums,
  getCanonicalLibraryRefresh,
  getDownloadStatuses,
  getLibraryArtistId,
  lookupLibraryAlbums,
  lookupLibraryArtists,
  refreshCanonicalLibrary,
  requestAlbumFromSearch,
  requestTrackDownload,
} from "@/lib/api/library";
import { getEditorialLinks, getEditorialPlaylist } from "@/lib/api/search";
import { useSavedStatus } from "@/lib/offline/saved-library";
import { playAlbumFromTrack } from "@/lib/player/player";
import type { Album, Artist, Track } from "@/lib/types/library";

const ARTIST_MBID = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
const ALBUM_MBID = "b1392450-e666-3926-a536-22c65f834433";

const ALBUM: Album = {
  id: "12",
  canonicalId: "12",
  artistId: "3",
  artistName: "Radiohead",
  mbid: ALBUM_MBID,
  albumName: "OK Computer",
  title: "OK Computer",
  releaseDate: "1997-05-21",
  monitored: true,
  managed: true,
  identityKey: "album:ok-computer",
  userFavorite: false,
  statistics: { trackCount: 2, sizeOnDisk: 1, percentOfTracks: 100 },
};

const track = (id: string, discNumber: number, trackNumber: number): Track => ({
  id,
  mbid: "",
  trackName: `Track ${id}`,
  title: `Track ${id}`,
  discNumber,
  trackNumber,
  hasFile: true,
  size: 0,
  quality: "FLAC",
  streamPath: `/library/stream/12/${id}`,
});

const ARTIST: Artist = {
  id: "3",
  mbid: ARTIST_MBID,
  artistName: "Radiohead",
  monitored: true,
  addedAt: null,
  statistics: { albumCount: 1 } as Artist["statistics"],
  identityKey: "artist:radiohead",
  userFavorite: false,
  sources: ["aurral"],
};

let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions.clear();
  mockOffline = false;
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  (getCanonicalAlbum as jest.Mock).mockResolvedValue(ALBUM);
  (getCanonicalAlbumTracks as jest.Mock).mockResolvedValue([]);
  (getDownloadStatuses as jest.Mock).mockResolvedValue({});
  (lookupLibraryAlbums as jest.Mock).mockResolvedValue({});
  (lookupLibraryArtists as jest.Mock).mockResolvedValue({});
  (getCanonicalArtist as jest.Mock).mockResolvedValue(ARTIST);
  (getCanonicalArtistAlbums as jest.Mock).mockResolvedValue([]);
  (getDiscoveryFeedback as jest.Mock).mockResolvedValue([]);
  (addDiscoveryFeedback as jest.Mock).mockResolvedValue({ success: true });
  (deleteDiscoveryFeedback as jest.Mock).mockResolvedValue({ success: true });
});

afterEach(() => client.clear());

/** A tile's long press: opens the sheet for `target` through the provider. */
async function longPress(
  target:
    | { album: AlbumActionsTarget }
    | { artist: ArtistActionsTarget }
    | { playlist: PlaylistActionsTarget },
) {
  function Tile() {
    const { openAlbum, openArtist, openPlaylist } = useItemActions();
    return (
      <Pressable
        onPress={() =>
          "album" in target
            ? openAlbum(target.album)
            : "artist" in target
              ? openArtist(target.artist)
              : openPlaylist(target.playlist)
        }
      >
        <Text>Tile</Text>
      </Pressable>
    );
  }
  await render(
    <QueryClientProvider client={client}>
      <ItemActionsProvider>
        <Tile />
      </ItemActionsProvider>
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByText("Tile"));
}

describe("album sheet", () => {
  const LIBRARY_ALBUM: AlbumActionsTarget = {
    ref: "12",
    mbid: ALBUM_MBID,
    title: "OK Computer",
    artistName: "Radiohead",
    artistMbid: ARTIST_MBID,
  };

  it("plays a Library album in disc order", async () => {
    (getCanonicalAlbumTracks as jest.Mock).mockResolvedValue([
      track("2", 2, 1),
      track("1", 1, 2),
      track("0", 1, 1),
    ]);
    await longPress({ album: LIBRARY_ALBUM });

    await fireEvent.press(await screen.findByLabelText("Play OK Computer"));

    expect(playAlbumFromTrack).toHaveBeenCalledTimes(1);
    const [played, first] = (playAlbumFromTrack as jest.Mock).mock.calls[0];
    expect(played.map((t: Track) => t.id)).toEqual(["0", "1", "2"]);
    expect(first.id).toBe("0");
  });

  it.each([
    {
      found: "an album the Library has, found by its MBID",
      album: {
        mbid: ALBUM_MBID,
        title: "OK Computer",
        artistName: "Radiohead",
      },
      lookup: {
        [ALBUM_MBID]: {
          libraryAlbumId: "12",
          libraryArtistId: "3",
          status: "available",
        },
      },
      links: null,
      offers: "Play Next",
    },
    {
      found: "an album the Library lacks",
      album: {
        mbid: ALBUM_MBID,
        title: "OK Computer",
        artistName: "Radiohead",
      },
      lookup: {},
      links: null,
      offers: "Add Album",
    },
    {
      found: "a chart album, found by name",
      album: { title: "OK Computer", artistName: "Radiohead" },
      lookup: {},
      links: { albumMbid: ALBUM_MBID, artistMbid: ARTIST_MBID },
      offers: "Add Album",
    },
  ])("offers $offers for $found", async ({ album, lookup, links, offers }) => {
    mockPermissions.add("addAlbum");
    (lookupLibraryAlbums as jest.Mock).mockResolvedValue(lookup);
    (getEditorialLinks as jest.Mock).mockResolvedValue(links);

    await longPress({ album });

    expect(await screen.findByText(offers)).toBeTruthy();
    expect(lookupLibraryAlbums).toHaveBeenCalledWith([ALBUM_MBID]);
  });

  it("offers no Add Album when the Library lookup fails", async () => {
    mockPermissions.add("addAlbum");
    (lookupLibraryAlbums as jest.Mock).mockRejectedValue(new Error("500"));

    await longPress({
      album: {
        mbid: ALBUM_MBID,
        title: "OK Computer",
        artistName: "Radiohead",
      },
    });

    expect(
      await screen.findByText("Couldn't check your Library. Try again."),
    ).toBeTruthy();
    expect(screen.queryByText("Add Album")).toBeNull();
  });

  it("adds a release whose feed names the artist by MBID as a request, not by Library id", async () => {
    mockPermissions.add("addAlbum");
    (getLibraryArtistId as jest.Mock).mockResolvedValue(null);
    (requestAlbumFromSearch as jest.Mock).mockResolvedValue({
      createdArtist: true,
    });
    // A recommended artist's release carries the MBID in artistId.
    await longPress({
      album: recentReleaseTarget({
        id: "r1",
        releaseGroupMbid: ALBUM_MBID,
        albumName: "OK Computer",
        artistName: "Radiohead",
        artistMbid: ARTIST_MBID,
        artistId: ARTIST_MBID,
        releaseDate: null,
        coverUrl: null,
        albumType: "Album",
        secondaryTypes: [],
      }),
    });

    await fireEvent.press(await screen.findByText("Add Album"));

    expect(addLibraryAlbum).not.toHaveBeenCalled();
    expect(requestAlbumFromSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        albumMbid: ALBUM_MBID,
        artistMbid: ARTIST_MBID,
      }),
    );
  });

  it.each([
    {
      album: "saved on the phone",
      saved: { state: "saved", item: { kind: "album", tracks: [] } },
      shows: ["Play Next", "Add to Queue", "Remove from Phone"],
    },
    { album: "not saved", saved: null, shows: ["Not saved on this phone."] },
  ])(
    "offline, offers only what works for an album $album",
    async ({ saved, shows }) => {
      mockOffline = true;
      (useSavedStatus as jest.Mock).mockReturnValue(saved);

      await longPress({ album: LIBRARY_ALBUM });

      for (const text of shows) {
        expect(await screen.findByText(text)).toBeTruthy();
      }
      for (const text of ["Start Radio", "Add to Favorites", "Go to Artist"]) {
        expect(screen.queryByText(text)).toBeNull();
      }
    },
  );
});

describe("artist sheet", () => {
  const TARGET: ArtistActionsTarget = { ref: ARTIST_MBID, name: "Radiohead" };

  it("offers a Library artist's actions", async () => {
    (lookupLibraryArtists as jest.Mock).mockResolvedValue({
      [ARTIST_MBID]: true,
    });
    await longPress({ artist: TARGET });

    expect(await screen.findByLabelText("Play Radiohead")).toBeTruthy();
    expect(screen.getByText("Start Radio")).toBeTruthy();
    expect(await screen.findByText("Add to Favorites")).toBeTruthy();
    expect(screen.getByText("Block Artist")).toBeTruthy();
    expect(screen.queryByText("Add to Library")).toBeNull();
    expect(screen.queryByText("More Like This")).toBeNull();
  });

  it("reports a rescan once it finishes, after the sheet has closed", async () => {
    (lookupLibraryArtists as jest.Mock).mockResolvedValue({
      [ARTIST_MBID]: true,
    });
    (refreshCanonicalLibrary as jest.Mock).mockResolvedValue({ jobId: 4 });
    (getCanonicalLibraryRefresh as jest.Mock).mockResolvedValue({
      status: "completed",
    });
    await longPress({ artist: TARGET });

    await fireEvent.press(await screen.findByText("Rescan Files"));

    expect((refreshCanonicalLibrary as jest.Mock).mock.calls[0][0]).toEqual({
      artistId: 3,
    });
    await screen.findByText("Tile");
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rescanned Radiohead" }),
    );
  });

  it("offers adding an artist the Library lacks, and marks the rating given", async () => {
    mockPermissions.add("addArtist");
    (getDiscoveryFeedback as jest.Mock).mockResolvedValue([
      {
        id: "f1",
        action: "less_like_this",
        artistId: ARTIST_MBID,
        artistName: "Radiohead",
      },
    ]);
    await longPress({ artist: TARGET });

    expect(await screen.findByText("Add to Library")).toBeTruthy();
    await screen.findByRole("button", {
      name: "Less Like This",
      selected: true,
    });
    expect(
      screen.getByRole("button", { name: "More Like This" }).props
        .accessibilityState,
    ).toEqual({ disabled: false, selected: undefined });
  });

  it.each([
    {
      press: "the other rating",
      label: "More Like This",
      deleted: ["f1"],
      added: "more_like_this",
    },
    {
      press: "the rating given",
      label: "Less Like This",
      deleted: ["f1"],
      added: null,
    },
  ])(
    "takes back the rating given when $press is tapped",
    async ({ label, deleted, added }) => {
      (getDiscoveryFeedback as jest.Mock).mockResolvedValue([
        {
          id: "f1",
          action: "less_like_this",
          artistId: ARTIST_MBID,
          artistName: "Radiohead",
        },
      ]);
      await longPress({ artist: TARGET });
      await screen.findByRole("button", {
        name: "Less Like This",
        selected: true,
      });

      await fireEvent.press(screen.getByText(label));
      await screen.findByText("Tile");

      expect(
        (deleteDiscoveryFeedback as jest.Mock).mock.calls.map(([id]) => id),
      ).toEqual(deleted);
      if (added) {
        expect(addDiscoveryFeedback).toHaveBeenCalledWith(
          expect.objectContaining({ action: added, artistId: ARTIST_MBID }),
        );
      } else {
        expect(addDiscoveryFeedback).not.toHaveBeenCalled();
      }
    },
  );
});

describe("playlist sheet", () => {
  const CARD: PlaylistActionsTarget = {
    provider: "deezer",
    id: "878",
    name: "90s Hits",
    description: null,
    trackCount: 3,
    artworkUrl: null,
    curator: null,
  };
  const song = (trackName: string, owned = false) => ({
    artistName: "Nirvana",
    trackName,
    albumName: "Nevermind",
    preview_url: null,
    artworkUrl: null,
    deezerAlbumId: null,
    owned: owned ? ({ id: trackName } as never) : null,
  });
  const PLAYLIST = {
    ...CARD,
    tracks: [song("Lithium"), song("Polly"), song("Breed", true)],
    libraryPlaylistId: null as string | null,
  };

  it.each([
    { saved: null, offers: "Add to Library" },
    { saved: "pl-1", offers: "Open in Library" },
  ])(
    "offers $offers for a playlist saved as $saved, and its missing songs",
    async ({ saved, offers }) => {
      mockPermissions.add("accessPlaylists");
      mockPermissions.add("addAlbum");
      (getEditorialPlaylist as jest.Mock).mockResolvedValue({
        ...PLAYLIST,
        libraryPlaylistId: saved,
      });

      await longPress({ playlist: CARD });

      expect(await screen.findByText(offers)).toBeTruthy();
      expect(screen.getByText("Download Missing Songs (2)")).toBeTruthy();
    },
  );

  it("downloads the missing songs after the sheet has closed", async () => {
    mockPermissions.add("addAlbum");
    (getEditorialPlaylist as jest.Mock).mockResolvedValue(PLAYLIST);
    (requestTrackDownload as jest.Mock).mockResolvedValue({ success: true });
    await longPress({ playlist: CARD });

    await fireEvent.press(
      await screen.findByText("Download Missing Songs (2)"),
    );
    await screen.findByText("Tile");

    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Downloading 2 songs" }),
      ),
    );
    expect(
      (requestTrackDownload as jest.Mock).mock.calls.map(([t]) => t.trackName),
    ).toEqual(["Lithium", "Polly"]);
  });
});
