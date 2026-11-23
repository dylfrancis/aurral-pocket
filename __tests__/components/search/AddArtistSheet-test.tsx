jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/lib/api/search", () => ({
  addArtist: jest.fn(),
}));

jest.mock("@/lib/api/library", () => ({
  getMonitoringDefaults: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components/settings/SettingsSwitch", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    SettingsSwitch: ({ value, onChange, accessibilityLabel }: any) =>
      React.createElement(Pressable, {
        accessibilityRole: "switch",
        accessibilityLabel,
        accessibilityState: { checked: value },
        onPress: () => onChange(!value),
      }),
  };
});

jest.mock("@/components/ui/PillRow", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) =>
      React.createElement(
        View,
        null,
        items.map((item: any) =>
          React.createElement(
            Pressable,
            {
              key: item.id,
              accessibilityLabel: item.label,
              accessibilityState: { selected: selected.includes(item.id) },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, item.label),
          ),
        ),
      ),
  };
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import * as Burnt from "burnt";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { useSheet } from "@/components/ui/AppSheet";
import { getMonitoringDefaults } from "@/lib/api/library";
import { addArtist } from "@/lib/api/search";
import type { MonitoringRules } from "@/lib/types/monitoring";

const mockAddArtist = addArtist as jest.Mock;
const mockGetDefaults = getMonitoringDefaults as jest.Mock;

// A fresh 3.0.0 server's defaults.
const DEFAULT_RULES: MonitoringRules = {
  catalog: "all",
  sinceYear: null,
  latestCount: 1,
  newReleases: true,
  types: ["album", "ep"],
  extraTypes: [],
  edition: "standard",
  topTracks: 0,
};

function OpenSheet() {
  const sheet = useSheet({ presented: true });
  return (
    <AddArtistSheet
      mbid="a74b1b7f-71a5-4011-9441-d0b5e4122711"
      artistName="Radiohead"
      sheet={sheet}
    />
  );
}

const clients: QueryClient[] = [];

async function renderSheet() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <OpenSheet />
    </QueryClientProvider>,
  );
  // The defaults have loaded once Default Rules sums them up.
  await screen.findByText("Everything and new releases · Albums and EPs");
}

async function pressAdd() {
  const add = screen.getAllByText("Add to Library");
  await fireEvent.press(add[add.length - 1]);
}

const sentMonitoring = () => mockAddArtist.mock.calls[0][0].monitoring;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDefaults.mockResolvedValue({
    rules: DEFAULT_RULES,
    updatedAt: null,
    artistCount: 0,
  });
  mockAddArtist.mockResolvedValue({
    queued: false,
    artistName: "Radiohead",
    artist: {
      id: "7",
      mbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      artistName: "Radiohead",
      monitored: true,
      statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
      monitoring: {
        queued: true,
        releaseGroupIds: ["rg-1", "rg-2", "rg-3"],
        topTracks: [],
      },
    },
  });
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("AddArtistSheet", () => {
  it("adds the artist on the default rules and says what was queued", async () => {
    await renderSheet();
    await pressAdd();

    expect(mockAddArtist).toHaveBeenCalledWith({
      foreignArtistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      artistName: "Radiohead",
      monitoring: { monitored: true, useDefault: true },
    });
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Added Radiohead",
        message: "Queued 3 releases",
      }),
    );
  });

  it("adds the artist unmonitored when asked to", async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText("Not Monitored"));
    await pressAdd();

    expect(sentMonitoring()).toEqual({ monitored: false });
  });

  it("sends custom rules as edited, starting from the defaults", async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText("Custom Rules"));

    await fireEvent.press(screen.getByLabelText("Since a Year"));
    await fireEvent.changeText(screen.getByLabelText("First Year"), "2001");
    await fireEvent.press(screen.getByLabelText("Albums"));
    // The server needs one primary type, so the last one stays on.
    await fireEvent.press(screen.getByLabelText("EPs"));
    await fireEvent.press(screen.getByLabelText("Live"));
    await fireEvent.press(screen.getByLabelText("Expanded"));
    await fireEvent.press(screen.getByLabelText("Top Tracks, more"));
    await fireEvent.press(screen.getByLabelText("New Releases"));
    await pressAdd();

    expect(sentMonitoring()).toEqual({
      monitored: true,
      useDefault: false,
      rules: {
        catalog: "since",
        sinceYear: 2001,
        latestCount: 1,
        newReleases: false,
        types: ["ep"],
        extraTypes: ["live"],
        edition: "expanded",
        topTracks: 1,
      },
    });
  });

  it("sends a year still being typed, brought into range", async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText("Custom Rules"));
    await fireEvent.press(screen.getByLabelText("Since a Year"));
    // Save doesn't blur the field, so the field never ends editing.
    await fireEvent.changeText(screen.getByLabelText("First Year"), "2999");
    await pressAdd();

    expect(sentMonitoring().rules.sinceYear).toBe(new Date().getFullYear() + 1);
  });

  it("still says how the add went after the sheet has closed", async () => {
    let finish!: (value: unknown) => void;
    mockAddArtist.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderSheet();
    await pressAdd();
    // Swiping the sheet down unmounts its content.
    await fireEvent.press(screen.getByLabelText("Dismiss sheet"));
    expect(screen.queryAllByText("Add to Library")).toHaveLength(0);
    await act(async () =>
      finish({
        queued: false,
        artistName: "Radiohead",
      }),
    );

    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Added Radiohead" }),
    );
  });

  it("holds back custom rules that would monitor nothing", async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText("Custom Rules"));
    await fireEvent.press(screen.getByLabelText("Nothing"));
    await fireEvent.press(screen.getByLabelText("New Releases"));

    expect(
      screen.getByText(
        "Choose a back catalogue, new releases or top tracks to monitor.",
      ),
    ).toBeTruthy();
    await pressAdd();
    expect(mockAddArtist).not.toHaveBeenCalled();
  });
});
