jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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
    BottomSheetView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("react-native-reorderable-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    default: ({ data, renderItem, keyExtractor }: any) =>
      React.createElement(FlatList, {
        data,
        renderItem,
        keyExtractor,
      }),
    reorderItems: <T,>(items: T[], from: number, to: number): T[] => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    },
    useReorderableDrag: () => jest.fn(),
  };
});

import React from "react";
import {
  render,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react-native";
import { CustomizeDiscoverSheet } from "@/components/discover/CustomizeDiscoverSheet";
import { DEFAULT_DISCOVER_SECTIONS } from "@/hooks/discover/use-discover-layout";
import type { DiscoverSection } from "@/lib/types/me";

function makeSheetRef() {
  return {
    current: {
      present: jest.fn(),
      dismiss: jest.fn(),
      close: jest.fn(),
    },
  } as any;
}

const defaults = (): DiscoverSection[] =>
  DEFAULT_DISCOVER_SECTIONS.map((s) => ({ ...s }));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CustomizeDiscoverSheet", () => {
  it("renders every section label", async () => {
    const sheetRef = makeSheetRef();
    const { getByText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={defaults()}
        onSave={jest.fn()}
      />,
    );

    for (const section of DEFAULT_DISCOVER_SECTIONS) {
      expect(getByText(section.label)).toBeTruthy();
    }
  });

  it("save passes the current draft to onSave and dismisses on success", async () => {
    const sheetRef = makeSheetRef();
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={defaults()}
        onSave={onSave}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText("Save"));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(defaults());
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("toggling a section updates the draft sent to onSave", async () => {
    const sheetRef = makeSheetRef();
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={defaults()}
        onSave={onSave}
      />,
    );

    const row = getByLabelText("Recently Added, enabled");
    const switchControl = within(row).getByRole("switch");
    await act(async () => {
      await fireEvent(switchControl, "valueChange", false);
    });

    await act(async () => {
      await fireEvent.press(getByText("Save"));
    });

    const arg = onSave.mock.calls[0][0] as DiscoverSection[];
    const recentlyAdded = arg.find((s) => s.id === "recentlyAdded");
    expect(recentlyAdded?.enabled).toBe(false);
  });

  it("reset restores defaults in the draft", async () => {
    const sheetRef = makeSheetRef();
    const onSave = jest.fn().mockResolvedValue(undefined);
    const customSections: DiscoverSection[] = [
      { id: "topTags", label: "Explore by Tag", enabled: false },
      { id: "recentlyAdded", label: "Recently Added", enabled: false },
      { id: "recommendedShows", label: "Shows Near You", enabled: false },
      { id: "recentReleases", label: "Recent Releases", enabled: false },
      { id: "recommended", label: "Recommended for You", enabled: false },
      { id: "globalTop", label: "Global Trending", enabled: false },
      { id: "genreSections", label: "Because You Like", enabled: false },
    ];

    const { getByText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={customSections}
        onSave={onSave}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText("Reset to Default"));
    });

    await act(async () => {
      await fireEvent.press(getByText("Save"));
    });

    expect(onSave).toHaveBeenCalledWith(defaults());
  });

  it("does not dismiss when save throws, surfaces error to caller", async () => {
    const sheetRef = makeSheetRef();
    const onSave = jest.fn().mockRejectedValue(new Error("server boom"));
    const onSaveError = jest.fn();
    const { getByText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={defaults()}
        onSave={onSave}
        onSaveError={onSaveError}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText("Save"));
    });

    await waitFor(() => expect(onSaveError).toHaveBeenCalledTimes(1));
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
  });

  it("close button dismisses the sheet", async () => {
    const sheetRef = makeSheetRef();
    const { getByLabelText } = await render(
      <CustomizeDiscoverSheet
        sheetRef={sheetRef}
        sections={defaults()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(getByLabelText("Close"));
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });
});
