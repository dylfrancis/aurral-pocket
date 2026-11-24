jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
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

// Android's list renders as a FlatList, keeping its onReorder for the test.
let mockOnReorder: ((event: { from: number; to: number }) => void) | undefined;
jest.mock("react-native-reorderable-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    default: ({
      data,
      onReorder,
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ListFooterComponent,
    }: any) => {
      mockOnReorder = onReorder;
      return React.createElement(FlatList, {
        data,
        renderItem,
        keyExtractor,
        ListHeaderComponent,
        ListFooterComponent,
      });
    },
    reorderItems: <T,>(items: T[], from: number, to: number): T[] => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    },
    useReorderableDrag: () => jest.fn(),
  };
});

// SwiftUI can't render under Jest, so iOS's list stands in as plain views: a
// labelled switch per section, buttons named by their labels, and the rows'
// onMove kept for the test.
let mockOnMove: ((source: number[], destination: number) => void) | undefined;
jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));
jest.mock("@expo/ui/swift-ui", () => {
  const React = require("react");
  const { Pressable, Switch, Text, View } = require("react-native");
  const Group = ({ children }: any) =>
    React.createElement(View, null, children);
  const ForEach = ({ data, children, onMove }: any) => {
    mockOnMove = onMove;
    return React.createElement(
      View,
      null,
      data.map((item: any, index: number) =>
        React.createElement(
          React.Fragment,
          { key: item.id },
          children({ item, index }),
        ),
      ),
    );
  };
  return {
    List: Object.assign(Group, { ForEach }),
    Section: ({ header, children }: any) =>
      React.createElement(View, null, header, children),
    VStack: Group,
    Text: ({ children }: any) => React.createElement(Text, null, children),
    Toggle: ({ label, isOn, onIsOnChange }: any) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, label),
        React.createElement(Switch, {
          accessibilityLabel: label,
          value: isOn,
          onValueChange: onIsOnChange,
        }),
      ),
    Button: ({ label, onPress }: any) =>
      React.createElement(
        Pressable,
        { onPress },
        React.createElement(Text, null, label),
      ),
  };
});

import React from "react";
import { Alert } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { DiscoverLayoutScreen } from "@/components/settings/DiscoverLayoutScreen";
import { IS_IOS } from "@/constants/platform";
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

// iOS draws a section as a SwiftUI toggle named by its label, and Android as a
// row named with its state that holds React Native's switch.
async function turnOff(label: string) {
  // getByRole only recognises the iOS switch host, so it misses Android's.
  const control = IS_IOS
    ? screen.getByLabelText(label)
    : screen
        .getByLabelText(`${label}, enabled`)
        .queryAll((node) => node.props.accessibilityRole === "switch")[0];
  await act(async () => {
    await fireEvent(control, "valueChange", false);
  });
}

// SwiftUI counts a drop's destination before the moved row comes out, and
// Android's list reports the row's new index.
async function moveToEnd(index: number, count: number) {
  await act(async () => {
    if (IS_IOS) mockOnMove!([index], count);
    else mockOnReorder!({ from: index, to: count - 1 });
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
    const { getByText } = await renderScreen();

    await turnOff("Recently Added");
    await save(getByText);

    const sent = mockLayout.saveLayout.mock.calls[0][0] as DiscoverSection[];
    expect(sent.find((s) => s.id === "recentlyAdded")?.enabled).toBe(false);
  });

  it("saves the sections in their new order", async () => {
    const { getByText } = await renderScreen();

    await moveToEnd(0, DEFAULT_DISCOVER_SECTIONS.length);
    await save(getByText);

    const [first, ...rest] = defaults();
    expect(mockLayout.saveLayout).toHaveBeenCalledWith([...rest, first]);
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
