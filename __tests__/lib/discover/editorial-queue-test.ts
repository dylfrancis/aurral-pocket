import { editorialQueue } from "@/lib/discover/editorial-queue";
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
  it("plays the Library's file where it has the song, the clip elsewhere, and skips a song with neither", () => {
    const queue = editorialQueue(
      playlist([
        track("Airbag", { owned }),
        track("Nude", { preview_url: "/api/deezer/preview/9.mp3" }),
        track("Lift", {}),
      ]),
    );

    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({
      id: "30",
      streamPath: "/library/stream/4/30",
    });
    expect(queue[1]).toMatchObject({
      title: "Nude",
      streamPath: null,
      isPreview: true,
      url: "https://music.example/api/deezer/preview/9.mp3",
    });
  });
});
