jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/lib/api/library", () => ({
  getArtistMatches: jest.fn(),
  setLibraryArtistMbid: jest.fn(),
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockDismiss = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { TextInput, View } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: mockDismiss,
    }));
    return <View>{children}</View>;
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetModal: BottomSheet,
    BottomSheetBackdrop: (props: any) => <View {...props} />,
    BottomSheetScrollView: ({ children }: any) => <View>{children}</View>,
    BottomSheetTextInput: (props: any) => <TextInput {...props} />,
  };
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Burnt from "burnt";
import { MatchArtistSheet } from "@/components/artist/MatchArtistSheet";
import { getArtistMatches, setLibraryArtistMbid } from "@/lib/api/library";
import type { ArtistMatch } from "@/lib/types/library";

const mockGetMatches = getArtistMatches as jest.Mock;
const mockSetMbid = setLibraryArtistMbid as jest.Mock;

const ACDC = "66c662b6-6e2f-4930-8610-912e24c63ed1";
const TRIBUTE = "11111111-2222-4333-8444-555555555555";

const match = (overrides: Partial<ArtistMatch> & { id: string }) => ({
  name: "AC/DC",
  disambiguation: null,
  type: "Group",
  imageUrl: null,
  libraryArtistId: null,
  ...overrides,
});

const RESULT = {
  id: 12,
  mbid: ACDC,
  name: "AC/DC",
  musicbrainzName: "AC/DC",
  merged: false,
};

async function openSheet(currentMbid?: string) {
  const onSaved = jest.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <MatchArtistSheet
        libraryArtistId="12"
        artistName="AC/DC"
        currentMbid={currentMbid}
        onSaved={onSaved}
        onDismiss={jest.fn()}
      />
    </QueryClientProvider>,
  );
  return onSaved;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMatches.mockResolvedValue([
    match({ id: ACDC, disambiguation: "Australian hard rock band" }),
    match({ id: TRIBUTE, name: "AC/DC Tribute", libraryArtistId: 99 }),
  ]);
  mockSetMbid.mockResolvedValue(RESULT);
});

it("searches by the artist's name and saves the match picked", async () => {
  const onSaved = await openSheet();

  expect(mockGetMatches).toHaveBeenCalledWith("12", "AC/DC", expect.anything());
  expect(screen.getByText("Australian hard rock band · Group")).toBeTruthy();
  // Another Library artist holds that MBID, so a match there merges.
  expect(screen.getByText("Group · In your Library")).toBeTruthy();

  await fireEvent.press(screen.getByText("AC/DC Tribute"));
  await fireEvent.press(screen.getByText("Save"));

  expect(mockSetMbid).toHaveBeenCalledWith("12", TRIBUTE);
  expect(onSaved).toHaveBeenCalledWith(RESULT);
  expect(mockDismiss).toHaveBeenCalled();
});

it("picks the one match named exactly like the artist", async () => {
  await openSheet();

  await fireEvent.press(screen.getByText("Save"));

  expect(mockSetMbid).toHaveBeenCalledWith("12", ACDC);
});

it("drops a pick that a new search no longer shows", async () => {
  await openSheet();
  await fireEvent.press(screen.getByText("AC/DC Tribute"));

  mockGetMatches.mockResolvedValue([match({ id: ACDC })]);
  await fireEvent.changeText(
    screen.getByPlaceholderText("Search or paste a MusicBrainz link"),
    "AC/DC band",
  );
  await waitFor(() => expect(screen.queryByText("AC/DC Tribute")).toBeNull());
  await fireEvent.press(screen.getByText("Save"));

  expect(mockSetMbid).toHaveBeenCalledWith("12", ACDC);
});

it("saves the MBID in a pasted MusicBrainz link", async () => {
  await openSheet();

  await fireEvent.changeText(
    screen.getByPlaceholderText("Search or paste a MusicBrainz link"),
    "https://musicbrainz.org/artist/66C662B6-6E2F-4930-8610-912E24C63ED1",
  );
  await fireEvent.press(screen.getByText("Save"));

  expect(screen.getByText("MusicBrainz ID")).toBeTruthy();
  expect(mockSetMbid).toHaveBeenCalledWith("12", ACDC);
});

it("removes the match of a matched artist", async () => {
  await openSheet(ACDC);

  await fireEvent.press(screen.getByText("Remove Match"));

  expect(mockSetMbid).toHaveBeenCalledWith("12", null);
});

it("says when the matches can't load, and tries again", async () => {
  mockGetMatches.mockRejectedValueOnce(
    new Error("Could not reach the metadata provider. Try again."),
  );
  await openSheet();

  expect(screen.getByText("Couldn't load matches")).toBeTruthy();
  await fireEvent.press(screen.getByText("Try Again"));

  expect(mockGetMatches).toHaveBeenCalledTimes(2);
  expect(await screen.findByText("AC/DC Tribute")).toBeTruthy();
});

it("stays open with the pick when the save fails", async () => {
  mockSetMbid.mockRejectedValue(
    new Error("MusicBrainz has no artist with that ID"),
  );
  const onSaved = await openSheet();

  await fireEvent.press(screen.getByText("Save"));

  expect(Burnt.toast).toHaveBeenCalledWith({
    title: "Couldn't save the match",
    message: "MusicBrainz has no artist with that ID",
    preset: "error",
  });
  expect(onSaved).not.toHaveBeenCalled();
  expect(mockDismiss).not.toHaveBeenCalled();
});
