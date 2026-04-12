const mockMutate = jest.fn();
const mockMutation = {
  mutate: mockMutate,
  isPending: false,
  isSuccess: false,
};

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/hooks/search/use-add-artist", () => ({
  useAddArtist: jest.fn((_onSuccess?: () => void) => mockMutation),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      close: jest.fn(),
      snapToIndex: jest.fn(),
    }));
    return <View {...props}>{children}</View>;
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: (props: any) => <View {...props} />,
    BottomSheetScrollView: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";

const sheetRef = {
  current: { close: jest.fn(), snapToIndex: jest.fn() },
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockMutation.isPending = false;
  mockMutation.isSuccess = false;
});

describe("AddArtistSheet", () => {
  it("renders all monitor option labels", () => {
    const { getByText } = render(
      <AddArtistSheet
        mbid="abc-123"
        artistName="Radiohead"
        sheetRef={sheetRef}
      />,
    );
    expect(getByText("None")).toBeTruthy();
    expect(getByText("All Albums")).toBeTruthy();
    expect(getByText("Future Albums")).toBeTruthy();
    expect(getByText("Missing Albums")).toBeTruthy();
    expect(getByText("Latest Album")).toBeTruthy();
    expect(getByText("First Album")).toBeTruthy();
  });

  it("renders artist name", () => {
    const { getByText } = render(
      <AddArtistSheet
        mbid="abc-123"
        artistName="Radiohead"
        sheetRef={sheetRef}
      />,
    );
    expect(getByText("Radiohead")).toBeTruthy();
  });

  it("calls mutate with correct params when add button is pressed", () => {
    const { getAllByText } = render(
      <AddArtistSheet
        mbid="abc-123"
        artistName="Radiohead"
        sheetRef={sheetRef}
      />,
    );
    // "Add to Library" appears as both header title and button text — press the last one (button)
    const elements = getAllByText("Add to Library");
    fireEvent.press(elements[elements.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith({
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitorOption: "all",
    });
  });

  it("allows changing monitor option before adding", () => {
    const { getByText, getAllByText } = render(
      <AddArtistSheet
        mbid="abc-123"
        artistName="Radiohead"
        sheetRef={sheetRef}
      />,
    );
    fireEvent.press(getByText("Future Albums"));
    const elements = getAllByText("Add to Library");
    fireEvent.press(elements[elements.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith({
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitorOption: "future",
    });
  });

  it('shows "Added" text on success', () => {
    mockMutation.isSuccess = true;
    const { getByText } = render(
      <AddArtistSheet
        mbid="abc-123"
        artistName="Radiohead"
        sheetRef={sheetRef}
      />,
    );
    expect(getByText("Added")).toBeTruthy();
  });
});
