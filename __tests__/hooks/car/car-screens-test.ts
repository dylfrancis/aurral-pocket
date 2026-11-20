jest.mock("@/hooks/car/car-library", () => ({
  ...jest.requireActual("@/hooks/car/car-library"),
  forgetCarLists: jest.fn(),
  loadCarList: jest.fn(),
  searchCar: jest.fn(),
}));

jest.mock("@/lib/headless-session", () => ({
  headlessSession: jest.fn(),
  onSessionCleared: jest.fn(),
}));

jest.mock("@/lib/player/player", () => ({
  preparePlayer: jest.fn(async () => {}),
  restoreSavedQueue: jest.fn(async () => true),
  shelveForCar: jest.fn(),
}));

import { loadCarList, type CarList } from "@/hooks/car/car-library";
import { registerCar } from "@/hooks/car/car-screens";
import { headlessSession, onSessionCleared } from "@/lib/headless-session";
import { restoreSavedQueue, shelveForCar } from "@/lib/player/player";
import {
  AndroidAutoMediaLibraryHelper,
  CarPlayHelper,
} from "react-native-nitro-player";

const carPlay = CarPlayHelper as jest.Mocked<typeof CarPlayHelper>;
const androidAuto = AndroidAutoMediaLibraryHelper as jest.Mocked<
  typeof AndroidAutoMediaLibraryHelper
>;

const albumRow = {
  id: "album:12",
  kind: "list" as const,
  title: "Kid A",
  subtitle: "Radiohead",
  image: "https://test.example/cover",
};

function songList(play: CarList["play"] = jest.fn()): CarList {
  return {
    title: "Kid A",
    rows: [{ id: "77", kind: "song", title: "Idioteque", image: null }],
    songs: [
      {
        id: "77",
        title: "Idioteque",
        artist: "Radiohead",
        album: "Kid A",
        duration: 0,
        url: "https://test.example/library/stream/12/77",
        artwork: null,
        streamPath: "/library/stream/12/77",
        coverPath: null,
        trackMbid: null,
        artistMbid: null,
        albumMbid: null,
        favorite: null,
      },
    ],
    play,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CarPlay", () => {
  beforeEach(() => {
    carPlay.isAvailable.mockReturnValue(true);
    androidAuto.isAvailable.mockReturnValue(false);
    registerCar();
  });

  const loader = () => carPlay.setTemplateLoader.mock.calls[0][0];
  const onSelect = () => carPlay.onSelect.mock.calls[0][0];

  it("opens a row's list through the loader, and leaves a song for pocket's player to play", async () => {
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "Library",
      rows: [
        albumRow,
        { id: "77", kind: "song", title: "Idioteque", image: null },
      ],
    });

    const template = await loader()("library");

    expect(template).toMatchObject({
      type: "list",
      id: "library",
      title: "Library",
      sections: [
        {
          items: [
            {
              id: "album:12",
              title: "Kid A",
              subtitle: "Radiohead",
              image: "https://test.example/cover",
              loadTemplate: true,
            },
            // No playlistId: the engine would play the song itself.
            { id: "77", title: "Idioteque", trackId: "77" },
          ],
        },
      ],
    });
  });

  it("reads its lists again once sign-out has cleared the session", () => {
    const signedOut = (onSessionCleared as jest.Mock).mock.calls[0][0];

    signedOut();

    expect(carPlay.reload).toHaveBeenCalled();
  });

  it.each([
    [true, 1],
    [false, 0],
  ])(
    "plays a picked song from its list, opening Now Playing once it starts (%s)",
    async (started, nowPlayingCalls) => {
      const play = jest.fn(async () => started);
      (loadCarList as jest.Mock).mockResolvedValue(songList(play));
      await loader()("album:12");

      onSelect()("77", "album:12");
      await new Promise(process.nextTick);

      expect(play).toHaveBeenCalledWith("77");
      expect(carPlay.showNowPlaying).toHaveBeenCalledTimes(nowPlayingCalls);
    },
  );

  it("shuffles the list from a Shuffle row at its top, then opens Now Playing", async () => {
    const shuffle = jest.fn(async () => true);
    (loadCarList as jest.Mock).mockResolvedValue({ ...songList(), shuffle });

    const template = await loader()("album:12");
    const [first] =
      template?.type === "list" ? template.sections![0].items : [];
    onSelect()(first.id, "album:12");
    await new Promise(process.nextTick);

    expect(first).toMatchObject({ title: "Shuffle" });
    expect(shuffle).toHaveBeenCalled();
    expect(carPlay.showNowPlaying).toHaveBeenCalled();
  });

  it("splits a list sorted by name into letters CarPlay's side index jumps to", async () => {
    const artist = (title: string) => ({
      id: `artist:${title}`,
      kind: "list" as const,
      title,
      image: null,
    });
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "Artists",
      alphabetical: true,
      rows: ["!!!", "2Pac", "ABBA", "Ásgeir", "Björk"].map(artist),
    });

    const template = await loader()("artists");
    const sections = template?.type === "list" ? template.sections : [];

    expect(
      sections?.map(({ header, indexTitle, items }) => [
        header,
        indexTitle,
        items.map((item) => ("title" in item ? item.title : "")),
      ]),
    ).toEqual([
      ["#", "#", ["!!!", "2Pac"]],
      ["A", "A", ["ABBA", "Ásgeir"]],
      ["B", "B", ["Björk"]],
    ]);
  });

  it("leaves Shuffle out of an empty list, so it shows its empty title", async () => {
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "Kid A",
      rows: [],
      shuffle: jest.fn(),
      emptyTitle: "No songs to play",
    });

    const template = await loader()("album:12");

    expect(template).toMatchObject({
      sections: [{ items: [] }],
      emptyTitle: "No songs to play",
    });
  });
});

describe("Android Auto", () => {
  beforeEach(() => {
    carPlay.isAvailable.mockReturnValue(false);
    androidAuto.isAvailable.mockReturnValue(true);
    registerCar();
  });

  const childrenLoader = () => androidAuto.setChildrenLoader.mock.calls[0][0];

  /** The function a pick on the last shelf calls. */
  const shelfPick = () =>
    (shelveForCar as jest.Mock).mock.calls.at(-1)[1] as (
      trackId: string,
    ) => Promise<boolean>;

  it("lists a song by the shelf id it's picked by, and plays it from its list", async () => {
    const play = jest.fn(async () => true);
    const list = songList(play);
    (loadCarList as jest.Mock).mockResolvedValue(list);
    (shelveForCar as jest.Mock).mockResolvedValue(["shelf-1:car1~77"]);

    await expect(childrenLoader()("album:12")).resolves.toEqual([
      {
        id: "shelf-1:car1~77",
        title: "Idioteque",
        isPlayable: true,
        mediaType: "audio",
      },
    ]);
    expect(shelveForCar).toHaveBeenCalledWith(list.songs, expect.any(Function));
    await shelfPick()("77");
    expect(play).toHaveBeenCalledWith("77");
  });

  it("puts Shuffle first as a stand-in song, whose pick shuffles the list", async () => {
    const shuffle = jest.fn(async () => true);
    (loadCarList as jest.Mock).mockResolvedValue({ ...songList(), shuffle });
    (shelveForCar as jest.Mock).mockResolvedValue([
      "shelf-1:car1~shuffle",
      "shelf-1:car1~77",
    ]);

    const items = await childrenLoader()("album:12");
    await shelfPick()((shelveForCar as jest.Mock).mock.calls.at(-1)[0][0].id);

    expect(items?.map(({ id, title }) => [id, title])).toEqual([
      ["shelf-1:car1~shuffle", "Shuffle"],
      ["shelf-1:car1~77", "Idioteque"],
    ]);
    expect(shuffle).toHaveBeenCalled();
  });

  it("lists a row that opens a list as a folder the car reads when opened", async () => {
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "Recently Played",
      rows: [albumRow],
    });

    await expect(childrenLoader()("recently-played")).resolves.toEqual([
      expect.objectContaining({
        id: "album:12",
        isPlayable: false,
        mediaType: "folder",
        children: [],
      }),
    ]);
  });

  it("shows a row asking to sign in, since Android Auto shows no text for an empty list", async () => {
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "",
      rows: [],
      signedOut: true,
      emptyTitle: "Sign in to Aurral on your phone",
    });

    await expect(childrenLoader()("library")).resolves.toEqual([
      expect.objectContaining({ title: "Sign in to Aurral on your phone" }),
    ]);
  });

  it("opens the Library from the row that asks to sign in", async () => {
    (loadCarList as jest.Mock).mockResolvedValue({
      title: "Library",
      rows: [],
    });

    await childrenLoader()("signed-out");

    expect(loadCarList).toHaveBeenCalledWith("library");
  });

  it.each([
    [{ userId: 1 }, 1],
    [null, 0],
  ])(
    "brings back the last queue for the car only with an account (%p)",
    async (account, restores) => {
      (headlessSession as jest.Mock).mockResolvedValue(account);

      androidAuto.onPlaybackResumption.mock.calls[0][0]();
      await new Promise(process.nextTick);

      expect(restoreSavedQueue).toHaveBeenCalledTimes(restores);
    },
  );
});
