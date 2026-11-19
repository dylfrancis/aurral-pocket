import { offlineQueue } from "@/hooks/offline/use-play-saved-songs";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import type { SaveStatus, SavedItem } from "@/lib/offline/saved-library";
import type { FlowJob } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

const status = (item: SavedItem): SaveStatus => ({
  item,
  state: "saved",
  total: 1,
  saved: 1,
  failed: 0,
  bytes: 0,
});

const albumTrack = (id: string, title: string) =>
  ({
    id,
    trackName: title,
    title,
    hasFile: true,
    streamPath: `/library/stream/4/${id}`,
  }) as Track;

const album = status({
  kind: "album",
  id: "4",
  userId: 1,
  savedAt: 0,
  route: {
    title: "OK Computer",
    artistName: "Radiohead",
    artistMbid: "",
    albumMbid: "",
    coverUrl: "",
    libraryAlbumId: "4",
    artistId: "",
  },
  tracks: [albumTrack("30", "Airbag"), albumTrack("31", "Lucky")],
});

const playlist = status({
  kind: "playlist",
  id: "pl-1",
  userId: 1,
  savedAt: 0,
  playlist: { id: "pl-1", name: "Road Trip" } as never,
  jobs: [
    {
      id: "job-1",
      playlistType: "shared",
      artistName: "Portishead",
      trackName: "Roads",
      albumName: "Dummy",
      artistMbid: null,
      albumMbid: null,
      trackMbid: null,
      status: "done",
    } as FlowJob,
  ],
});

// Saved on its own as well as with its album.
const song = status({
  kind: "song",
  id: "31",
  userId: 1,
  savedAt: 0,
  track: {
    id: "31",
    title: "Lucky",
    artist: "Radiohead",
    album: "OK Computer",
    artwork: null,
    streamPath: "/library/stream/4/31",
  },
});

beforeAll(() => {
  setBaseUrl("https://music.example");
  setAuthToken("token");
});

describe("offlineQueue", () => {
  it("plays albums, then playlists, then songs, each track once", () => {
    const queue = offlineQueue([song, playlist, album]);

    expect(queue.map((item) => item.title)).toEqual([
      "Airbag",
      "Lucky",
      "Roads",
    ]);
    expect(queue[0]).toMatchObject({
      album: "OK Computer",
      artist: "Radiohead",
      albumRef: "4",
    });
  });
});
