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
