const mockOpen = jest.fn();
let mockCanAdd = true;

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/hooks/discover/use-adopt-discover-playlist", () => ({
  useAdoptDiscoverPlaylist: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
    variables: undefined,
  })),
}));

jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: jest.fn(() => ({
    canAddToPlaylist: mockCanAdd,
    track: null,
    open: mockOpen,
    close: jest.fn(),
  })),
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    FlashList: ({ renderScrollComponent, ...props }: any) =>
      React.createElement(FlatList, props),
  };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheetModal = React.forwardRef(function MockBottomSheetModal(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
      close: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    useBottomSheetScrollableCreator: () => undefined,
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { DiscoverPlaylistSheet } from "@/components/discover/DiscoverPlaylistSheet";
import type { DiscoverPlaylist } from "@/lib/types/search";

const PLAYLIST = {
  presetId: "preset-1",
  name: "Fresh Finds",
  tags: [],
  relatedArtists: [],
  recipe: {},
  trackCount: 2,
  adoptedFlowId: null,
  adoptedPlaylistId: null,
  tracks: [
    {
      artistName: "Radiohead",
      trackName: "Reckoner",
      albumName: "In Rainbows",
      artistMbid: "artist-mbid",
      albumMbid: "album-mbid",
      trackMbid: "track-mbid",
      releaseYear: 2007,
      reason: "Similar to your library",
    },
    {
      artistName: null,
      trackName: "Orphan Track",
      albumName: null,
      artistMbid: null,
      albumMbid: null,
      trackMbid: null,
      releaseYear: null,
      reason: null,
    },
  ],
} as unknown as DiscoverPlaylist;

/**
 * The server builds editorial playlists from a Last.fm tag chart. They omit
 * `tags`, `relatedArtists`, `mix` and `recipe` (issue #195).
 */
const EDITORIAL_PLAYLIST = {
  presetId: "editorial-shoegaze",
  name: "Shoegaze Essentials",
  description: null,
  type: "editorial",
  editorialType: "genre",
  tag: "shoegaze",
  size: 30,
  trackCount: 1,
  adoptedFlowId: null,
  adoptedPlaylistId: null,
  tracks: [
    {
      artistName: "Slowdive",
      trackName: "Alison",
      albumName: null,
      artistMbid: null,
      albumMbid: null,
      trackMbid: null,
      releaseYear: null,
      reason: "#1 on Last.fm",
    },
  ],
} as unknown as DiscoverPlaylist;

const sheetRef = { current: null } as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockCanAdd = true;
});

describe("DiscoverPlaylistSheet", () => {
  it("opens the add sheet with the full track fields", async () => {
    const { getByLabelText } = await render(
      <DiscoverPlaylistSheet
        sheetRef={sheetRef}
        playlist={PLAYLIST}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(getByLabelText("Add Reckoner to a playlist"));
    expect(mockOpen).toHaveBeenCalledWith({
      artistName: "Radiohead",
      trackName: "Reckoner",
      albumName: "In Rainbows",
      artistMbid: "artist-mbid",
      albumMbid: "album-mbid",
      trackMbid: "track-mbid",
      releaseYear: 2007,
      reason: "Similar to your library",
    });
  });

  it("shows no + button for a track without an artist name", async () => {
    const { queryByLabelText } = await render(
      <DiscoverPlaylistSheet
        sheetRef={sheetRef}
        playlist={PLAYLIST}
        onClose={jest.fn()}
      />,
    );
    expect(queryByLabelText("Add Orphan Track to a playlist")).toBeNull();
  });

  it("renders an editorial playlist that has no tags or related artists", async () => {
    const { getByText } = await render(
      <DiscoverPlaylistSheet
        sheetRef={sheetRef}
        playlist={EDITORIAL_PLAYLIST}
        onClose={jest.fn()}
      />,
    );
    expect(getByText("Shoegaze Essentials")).toBeTruthy();
    expect(getByText("Alison")).toBeTruthy();
  });

  it("shows no + buttons without the accessFlow permission", async () => {
    mockCanAdd = false;
    const { queryByLabelText } = await render(
      <DiscoverPlaylistSheet
        sheetRef={sheetRef}
        playlist={PLAYLIST}
        onClose={jest.fn()}
      />,
    );
    expect(queryByLabelText("Add Reckoner to a playlist")).toBeNull();
  });
});
