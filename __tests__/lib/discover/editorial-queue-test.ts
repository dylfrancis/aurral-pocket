import {
  editorialClipItem,
  editorialQueue,
} from "@/lib/discover/editorial-queue";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import type { LibraryQueueTrack } from "@/lib/types/library";
import type { EditorialPlaylist, EditorialTrack } from "@/lib/types/search";

const owned = {
  id: "30",
  title: "Airbag",
  artist: "Radiohead",
  album: "OK Computer",
  streamPath: "/library/stream/4/30",
  streamFormat: "flac",
  quality: null,
  durationMs: null,
  artistMbid: null,
  albumMbid: null,
  trackMbid: null,
  libraryTrackId: 30,
  libraryAlbumId: 4,
  libraryArtistId: 1,
  artworkUrl: null,
  artworkSource: "album",
} satisfies LibraryQueueTrack;

const track = (
  trackName: string,
  extra: Partial<EditorialTrack>,
): EditorialTrack => ({
  artistName: "Radiohead",
  trackName,
  albumName: null,
  preview_url: null,
  artworkUrl: null,
  deezerAlbumId: null,
  ...extra,
});

const playlist = (tracks: EditorialTrack[]): EditorialPlaylist => ({
  provider: "mix",
  id: "m1",
  name: "Daily Mix",
  description: null,
  curator: null,
  artworkUrl: null,
  tracks,
  libraryPlaylistId: null,
});

beforeAll(() => {
  setBaseUrl("https://music.example");
  setAuthToken("token");
});

describe("editorialQueue", () => {
  it("queues only the songs the Library has, as their Library files", () => {
    const queue = editorialQueue(
      playlist([
        track("Airbag", { owned }),
        track("Nude", { preview_url: "/api/deezer/preview/9.mp3" }),
      ]),
    );

    expect(queue).toEqual([
      expect.objectContaining({
        id: "30",
        streamPath: "/library/stream/4/30",
      }),
    ]);
  });
});

describe("editorialClipItem", () => {
  it("plays a missing song's clip, and has nothing for a song with none", () => {
    expect(
      editorialClipItem(
        "row-1",
        track("Nude", { preview_url: "/api/deezer/preview/9.mp3" }),
      ),
    ).toMatchObject({
      id: "row-1",
      title: "Nude",
      streamPath: null,
      isPreview: true,
      url: "https://music.example/api/deezer/preview/9.mp3?token=token",
    });
    expect(editorialClipItem("row-2", track("Lift", {}))).toBeNull();
  });
});
