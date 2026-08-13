const mockAddMutate = jest.fn();
const mockCreateMutate = jest.fn();
const mockAddMutation = { mutate: mockAddMutate, isPending: false };
const mockCreateMutation = { mutate: mockCreateMutate, isPending: false };
let mockPlaylists: { id: string; name: string; trackCount: number }[] = [];

jest.mock("@/hooks/flow/use-flow-selectors", () => ({
  useSharedPlaylists: jest.fn(() => mockPlaylists),
}));

jest.mock("@/hooks/flow/use-flow-mutations", () => ({
  useAddSharedPlaylistTracks: jest.fn(() => mockAddMutation),
  useCreateSharedPlaylist: jest.fn(() => mockCreateMutation),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(() => () => true),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View, TextInput } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      close: jest.fn(),
      snapToIndex: jest.fn(),
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return <View {...props}>{children}</View>;
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetModal: BottomSheet,
    BottomSheetBackdrop: (props: any) => <View {...props} />,
    BottomSheetScrollView: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
    BottomSheetTextInput: (props: any) => <TextInput {...props} />,
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { AddToPlaylistSheet } from "@/components/flow/AddToPlaylistSheet";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

const TRACK: SharedPlaylistTrack = {
  artistName: "Radiohead",
  trackName: "Weird Fishes",
  albumName: "In Rainbows",
  artistMbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlaylists = [];
  mockAddMutation.isPending = false;
  mockCreateMutation.isPending = false;
});

describe("AddToPlaylistSheet", () => {
  it("renders nothing while no track is set", async () => {
    const { toJSON } = await render(
      <AddToPlaylistSheet track={null} onClose={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows the track summary and the existing playlists", async () => {
    mockPlaylists = [
      { id: "pl-1", name: "Keepers", trackCount: 1 },
      { id: "pl-2", name: "Road Trip", trackCount: 12 },
    ];
    const { getByText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    expect(getByText('"Weird Fishes" · Radiohead')).toBeTruthy();
    expect(getByText("Keepers")).toBeTruthy();
    expect(getByText("1 track")).toBeTruthy();
    expect(getByText("Road Trip")).toBeTruthy();
    expect(getByText("12 tracks")).toBeTruthy();
  });

  it("appends the track when a playlist row is pressed", async () => {
    mockPlaylists = [{ id: "pl-2", name: "Road Trip", trackCount: 12 }];
    const { getByText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    await fireEvent.press(getByText("Road Trip"));
    expect(mockAddMutate).toHaveBeenCalledWith(
      { playlistId: "pl-2", tracks: [TRACK] },
      expect.any(Object),
    );
  });

  it("toasts on a successful append", async () => {
    mockPlaylists = [{ id: "pl-2", name: "Road Trip", trackCount: 12 }];
    mockAddMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    const { getByText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    await fireEvent.press(getByText("Road Trip"));
    expect(Burnt.toast).toHaveBeenCalledWith({
      title: 'Added to "Road Trip"',
      preset: "done",
    });
  });

  it("creates a playlist with the track when a name is entered", async () => {
    const { getByText, getByPlaceholderText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Playlist name"),
      "  Keepers  ",
    );
    await fireEvent.press(getByText("Create and Add"));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { name: "Keepers", tracks: [TRACK] },
      expect.any(Object),
    );
  });

  it("does not create a playlist while the name is blank", async () => {
    const { getByText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    await fireEvent.press(getByText("Create and Add"));
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("toasts the server message when the append fails", async () => {
    mockPlaylists = [{ id: "pl-2", name: "Road Trip", trackCount: 12 }];
    mockAddMutate.mockImplementation((_vars, opts) =>
      opts.onError(new Error("Shared playlist name already exists")),
    );
    const { getByText } = await render(
      <AddToPlaylistSheet track={TRACK} onClose={jest.fn()} />,
    );
    await fireEvent.press(getByText("Road Trip"));
    expect(Burnt.toast).toHaveBeenCalledWith({
      title: "Couldn't add track",
      message: "Shared playlist name already exists",
      preset: "error",
    });
  });
});
