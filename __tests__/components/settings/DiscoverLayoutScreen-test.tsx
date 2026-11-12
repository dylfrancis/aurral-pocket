jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockLayout = {
  sections: [] as DiscoverSection[],
  hydrated: true,
  saveLayout: jest.fn(),
};
jest.mock("@/hooks/discover/use-discover-layout", () => ({
  ...jest.requireActual("@/hooks/discover/use-discover-layout"),
  useDiscoverLayout: () => mockLayout,
}));

jest.mock("react-native-reorderable-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    default: ({
      data,
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ListFooterComponent,
    }: any) =>
      React.createElement(FlatList, {
        data,
        renderItem,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
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
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { DiscoverLayoutScreen } from "@/components/settings/DiscoverLayoutScreen";
import { DEFAULT_DISCOVER_SECTIONS } from "@/hooks/discover/use-discover-layout";
import type { DiscoverSection } from "@/lib/types/me";

const defaults = (): DiscoverSection[] =>
  DEFAULT_DISCOVER_SECTIONS.map((s) => ({ ...s }));

async function renderScreen(sections = defaults()) {
  mockLayout.sections = sections;
  return render(<DiscoverLayoutScreen />);
}

async function save(getByText: (text: string) => unknown) {
  await act(async () => {
    await fireEvent.press(getByText("Save") as never);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLayout.hydrated = true;
  mockLayout.saveLayout.mockResolvedValue(undefined);
});

describe("DiscoverLayoutScreen", () => {
  it("saves the layout as shown and goes back", async () => {
    const { getByText } = await renderScreen();

    for (const section of DEFAULT_DISCOVER_SECTIONS) {
      expect(getByText(section.label)).toBeTruthy();
    }
    await save(getByText);

    expect(mockLayout.saveLayout).toHaveBeenCalledWith(defaults());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("saves a section turned off", async () => {
    const { getByLabelText, getByText } = await renderScreen();

    const row = getByLabelText("Recently Added, enabled");
    // getByRole only recognises the iOS switch host, so it misses Android's.
    const [switchControl] = row.queryAll(
      (node) => node.props.accessibilityRole === "switch",
    );
    await act(async () => {
      await fireEvent(switchControl, "valueChange", false);
    });
    await save(getByText);

    const sent = mockLayout.saveLayout.mock.calls[0][0] as DiscoverSection[];
    expect(sent.find((s) => s.id === "recentlyAdded")?.enabled).toBe(false);
  });

  it("resets to the default layout", async () => {
    const { getByText } = await renderScreen(
      defaults()
        .reverse()
        .map((section) => ({ ...section, enabled: false })),
    );

    await act(async () => {
      await fireEvent.press(getByText("Reset to Default"));
    });
    await save(getByText);

    expect(mockLayout.saveLayout).toHaveBeenCalledWith(defaults());
  });

  it("stays on the page and says why when the save fails", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockLayout.saveLayout.mockRejectedValue(new Error("server boom"));
    const { getByText } = await renderScreen();

    await save(getByText);

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Could not save layout",
        "server boom",
      ),
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
