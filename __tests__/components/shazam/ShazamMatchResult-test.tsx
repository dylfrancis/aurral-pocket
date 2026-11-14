jest.mock("burnt", () => ({ toast: jest.fn() }));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

let mockPermissions: Record<string, boolean> = {};
jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => (perm: string) => !!mockPermissions[perm],
}));

jest.mock("@/lib/api/musicbrainz", () => ({
  ...jest.requireActual("@/lib/api/musicbrainz"),
  lookupRecordingsByIsrc: jest.fn(),
}));

jest.mock("@/lib/api/search", () => ({
  resolveStreamingLink: jest.fn(),
  searchArtists: jest.fn(),
  searchLibraryTracks: jest.fn(),
  addArtist: jest.fn(),
}));

jest.mock("@/lib/api/library", () => ({
  lookupLibraryArtists: jest.fn(() => Promise.resolve({})),
  getAlbumCover: jest.fn(() => Promise.resolve({ images: [] })),
}));

jest.mock("@/lib/player/player", () => ({
  playAlbumFromTrack: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/hooks/search/use-add-artist", () => ({
  useAddArtist: () => ({ mutate: jest.fn(), isPending: false }),
}));

// The sheet modules load for their hooks and helpers; their native parts
// never render here.
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  return {
    BottomSheetModal: View,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    BottomSheetTextInput: View,
    BottomSheetBackdrop: View,
  };
});

// The two sheets own their own contents; these stand-ins show what the match
// sheet hands them.
jest.mock("@/components/flow/AddToPlaylistSheet", () => {
  const { Text } = require("react-native");
  return {
    ...jest.requireActual("@/components/flow/AddToPlaylistSheet"),
    AddToPlaylistSheet: ({ track }: { track: unknown }) =>
      track ? (
        <Text testID="playlist-sheet">{JSON.stringify(track)}</Text>
      ) : null,
  };
});

jest.mock("@/components/library/TrackActionsSheet", () => {
  const { Text } = require("react-native");
  return {
    ...jest.requireActual("@/components/library/TrackActionsSheet"),
    TrackActionsSheet: ({
      target,
    }: {
      target: { track: { trackName: string } } | null;
    }) => (target ? <Text>Actions for {target.track.trackName}</Text> : null),
  };
});

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: object) => <View {...props} /> };
});

import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShazamMatchResult } from "@/components/shazam/ShazamMatchResult";
import {
  lookupRecordingsByIsrc,
  MusicBrainzUnavailableError,
  type IsrcRecording,
} from "@/lib/api/musicbrainz";
import {
  resolveStreamingLink,
  searchArtists,
  searchLibraryTracks,
} from "@/lib/api/search";
import { playAlbumFromTrack } from "@/lib/player/player";
import type { LibrarySearchTrack, StreamingLink } from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";

const mockLookupRecordings = lookupRecordingsByIsrc as jest.Mock;
const mockResolveLink = resolveStreamingLink as jest.Mock;
const mockSearchArtists = searchArtists as jest.Mock;
const mockSearchLibrary = searchLibraryTracks as jest.Mock;
const mockPlay = playAlbumFromTrack as jest.Mock;

const BLINDING_LIGHTS: ShazamMatch = {
  title: "Blinding Lights",
  artist: "The Weeknd",
  album: null,
  artworkUrl: "https://is1-ssl.mzstatic.com/blinding.jpg",
  appleMusicUrl: "https://music.apple.com/us/album/after-hours/1?i=2",
  isrc: "USUG11904206",
  shazamId: "1",
};

const BLINDING_RECORDING: IsrcRecording = {
  mbid: "rec-blinding",
  title: "Blinding Lights",
  artists: [{ mbid: "weeknd", name: "The Weeknd" }],
};

const BLINDING_LINK: StreamingLink = {
  kind: "track",
  artist: { name: "The Weeknd", mbid: "weeknd" },
  album: { title: "After Hours", mbid: "rg-after-hours" },
  track: { title: "Blinding Lights", mbid: "rec-blinding" },
  source: "appleMusic",
};

const LIBRARY_BLINDING: LibrarySearchTrack = {
  id: "9",
  title: "Blinding Lights",
  artistName: "The Weeknd",
  albumTitle: "After Hours",
  albumMbid: "rg-after-hours",
  albumCanonicalId: "4",
  trackMbid: "rec-blinding",
  artistMbid: "weeknd",
  releaseYear: "2020",
  durationMs: 200040,
  streamPath: "/library/canonical-stream/4/9",
};

const UNHOLY_RECORDING: IsrcRecording = {
  mbid: "rec-unholy",
  title: "Unholy",
  artists: [
    { mbid: "sam", name: "Sam Smith" },
    { mbid: "kim", name: "Kim Petras" },
  ],
};

// MusicBrainz files some ISRCs under a song and an audiobook chapter both.
const AUDIOBOOK_CHAPTER: IsrcRecording = {
  mbid: "rec-chapter",
  title: "Chapter 17",
  artists: [
    { mbid: "austen", name: "Jane Austen" },
    { mbid: "beckinsale", name: "Kate Beckinsale" },
  ],
};

const UNHOLY: ShazamMatch = {
  title: "Unholy",
  artist: "Sam Smith & Kim Petras",
  album: null,
  artworkUrl: null,
  appleMusicUrl: "https://music.apple.com/us/album/unholy/3?i=4",
  isrc: "GBUM72205415",
  shazamId: "2",
};

// Aurral answers a collaboration's link with every MBID null.
const UNHOLY_LINK: StreamingLink = {
  kind: "track",
  artist: { name: "Sam Smith & Kim Petras", mbid: null },
  album: { title: "Unholy", mbid: null },
  track: { title: "Unholy", mbid: null },
  source: "appleMusic",
};

const clients: QueryClient[] = [];

async function renderMatch(
  match: ShazamMatch,
  props: Partial<React.ComponentProps<typeof ShazamMatchResult>> = {},
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  clients.push(client);
  const handlers = {
    onViewArtist: jest.fn(),
    onViewRelease: jest.fn(),
    onSearchManually: jest.fn(),
    ...props,
  };
  await render(
    <QueryClientProvider client={client}>
      <ShazamMatchResult match={match} {...handlers} />
    </QueryClientProvider>,
  );
  return handlers;
}

function playlistSheetTrack() {
  return JSON.parse(
    String(screen.getByTestId("playlist-sheet").props.children),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = { accessFlow: true, addArtist: true };
  mockLookupRecordings.mockResolvedValue([BLINDING_RECORDING]);
  mockResolveLink.mockResolvedValue(BLINDING_LINK);
  mockSearchLibrary.mockResolvedValue([]);
  mockSearchArtists.mockResolvedValue({ artists: [] });
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("ShazamMatchResult", () => {
  it("plays the library's copy of a song you own, on its own", async () => {
    mockSearchLibrary.mockResolvedValue([
      {
        ...LIBRARY_BLINDING,
        id: "10",
        title: "Blinding Lights (Remix)",
        trackMbid: "rec-remix",
        streamPath: "/library/canonical-stream/4/10",
      },
      LIBRARY_BLINDING,
    ]);
    await renderMatch(BLINDING_LIGHTS);

    await fireEvent.press(await screen.findByLabelText("Play Blinding Lights"));

    expect(mockSearchLibrary).toHaveBeenCalledWith("Blinding Lights");
    const [queue, start] = mockPlay.mock.calls[0];
    expect(queue).toEqual([start]);
    expect(start).toMatchObject({
      id: "9",
      streamPath: "/library/canonical-stream/4/9",
    });
    expect(screen.queryByText("Add to Playlist")).toBeNull();
  });

  it("adds a song you own to a playlist as the album page does", async () => {
    // The same entry as from the album page, so a playlist that already holds
    // the song shows it as added.
    mockSearchLibrary.mockResolvedValue([LIBRARY_BLINDING]);
    await renderMatch(BLINDING_LIGHTS);

    await fireEvent.press(await screen.findByText("Playlist"));

    expect(playlistSheetTrack()).toEqual({
      artistName: "The Weeknd",
      trackName: "Blinding Lights",
      albumName: "After Hours",
      artistMbid: "weeknd",
    });
  });

  it("opens the track actions for a song you own", async () => {
    mockSearchLibrary.mockResolvedValue([LIBRARY_BLINDING]);
    await renderMatch(BLINDING_LIGHTS);

    await fireEvent.press(
      await screen.findByLabelText("More actions for Blinding Lights"),
    );

    expect(screen.getByText("Actions for Blinding Lights")).toBeTruthy();
  });

  it("offers a song you don't own for a playlist, with what both lookups found", async () => {
    await renderMatch(BLINDING_LIGHTS);

    await fireEvent.press(await screen.findByText("Add to Playlist"));

    expect(screen.queryByLabelText("Play Blinding Lights")).toBeNull();
    expect(playlistSheetTrack()).toEqual({
      artistName: "The Weeknd",
      trackName: "Blinding Lights",
      albumName: "After Hours",
      artistMbid: "weeknd",
      albumMbid: "rg-after-hours",
      trackMbid: "rec-blinding",
    });
  });

  it("shows the album and opens its release page, as held when you own the song", async () => {
    mockSearchLibrary.mockResolvedValue([LIBRARY_BLINDING]);
    const { onViewRelease } = await renderMatch(BLINDING_LIGHTS);

    await fireEvent.press(await screen.findByLabelText("After Hours · 2020"));

    expect(onViewRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        mbid: "rg-after-hours",
        title: "After Hours",
        artistName: "The Weeknd",
        artistMbid: "weeknd",
        status: "available",
      }),
    );
  });

  it("lists every artist the song's recording credits, and no album without an MBID", async () => {
    mockLookupRecordings.mockResolvedValue([
      AUDIOBOOK_CHAPTER,
      UNHOLY_RECORDING,
    ]);
    mockResolveLink.mockResolvedValue(UNHOLY_LINK);
    await renderMatch(UNHOLY);

    expect(await screen.findByText("Sam Smith")).toBeTruthy();
    expect(screen.getByText("Kim Petras")).toBeTruthy();
    expect(screen.queryByText("Jane Austen")).toBeNull();
    expect(screen.queryByText("Album")).toBeNull();
    expect(mockSearchArtists).not.toHaveBeenCalled();
  });

  it("shows the artists only once both lookups have answered", async () => {
    let answerLink!: (link: StreamingLink) => void;
    mockResolveLink.mockReturnValue(
      new Promise((resolve) => {
        answerLink = resolve;
      }),
    );
    mockLookupRecordings.mockResolvedValue([]);
    mockSearchArtists.mockResolvedValue({
      artists: [
        { id: "weeknd", name: "The Weeknd" },
        { id: "weekend", name: "The Weekend" },
      ],
    });
    await renderMatch(BLINDING_LIGHTS);

    // The ISRC missed; the name search waits on the link, which may name the
    // artist itself.
    await waitFor(() => expect(mockLookupRecordings).toHaveBeenCalled());
    expect(screen.queryByText("The Weekend")).toBeNull();
    expect(mockSearchArtists).not.toHaveBeenCalled();

    await act(async () => answerLink(BLINDING_LINK));

    expect(await screen.findByLabelText("Add The Weeknd")).toBeTruthy();
    expect(screen.queryByText("The Weekend")).toBeNull();
  });

  it("retries a busy MusicBrainz before falling back to a name search", async () => {
    mockLookupRecordings
      .mockRejectedValueOnce(new MusicBrainzUnavailableError(503))
      .mockResolvedValueOnce([UNHOLY_RECORDING]);
    mockResolveLink.mockResolvedValue(UNHOLY_LINK);
    await renderMatch(UNHOLY);

    expect(await screen.findByText("Kim Petras")).toBeTruthy();
    expect(mockLookupRecordings).toHaveBeenCalledTimes(2);
    expect(mockSearchArtists).not.toHaveBeenCalled();
  });

  it("falls back to a name search without the featured artist, telling same names apart", async () => {
    mockLookupRecordings.mockResolvedValue([]);
    mockResolveLink.mockRejectedValue(new Error("LINK_NOT_FOUND"));
    mockSearchArtists.mockResolvedValue({
      artists: [
        { id: "nv-us", name: "Nirvana", disambiguation: "US grunge band" },
        { id: "nv-uk", name: "Nirvana", disambiguation: "60s UK band" },
      ],
    });
    await renderMatch({
      ...BLINDING_LIGHTS,
      title: "Lithium",
      artist: "Nirvana feat. Someone",
    });

    expect(await screen.findByText("US grunge band")).toBeTruthy();
    expect(screen.getByText("60s UK band")).toBeTruthy();
    expect(mockSearchArtists).toHaveBeenCalledWith("Nirvana");
  });

  it("says when the name search failed, rather than that nobody matched", async () => {
    mockLookupRecordings.mockResolvedValue([]);
    mockResolveLink.mockRejectedValue(new Error("LINK_NOT_FOUND"));
    mockSearchArtists.mockRejectedValue(new Error("Network Error"));
    await renderMatch({ ...BLINDING_LIGHTS, artist: "Nirvana" });

    expect(
      await screen.findByText("Couldn't search for “Nirvana”"),
    ).toBeTruthy();
  });

  it("offers no playlist or artist adds without the permissions", async () => {
    mockPermissions = {};
    await renderMatch(BLINDING_LIGHTS);

    // The section label shows once the sheet has settled.
    expect(await screen.findByText("Artist")).toBeTruthy();
    expect(screen.queryByText("Add to Playlist")).toBeNull();
    expect(screen.queryByLabelText("Add The Weeknd")).toBeNull();
  });
});
