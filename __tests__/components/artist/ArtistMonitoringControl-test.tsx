jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/lib/api/library", () => ({
  getArtistMonitoring: jest.fn(),
  setArtistMonitoring: jest.fn(),
}));

const mockHasPermission = jest.fn((_permission: string) => true);
jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => mockHasPermission,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components/settings/SettingsSwitch", () => ({
  SettingsSwitch: () => null,
}));

jest.mock("@/components/ui/PillRow", () => ({ PillRow: () => null }));
jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { TextInput, View } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: mockPresent,
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
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import * as Burnt from "burnt";
import { ArtistMonitoringControl } from "@/components/artist/ArtistMonitoringControl";
import { getArtistMonitoring, setArtistMonitoring } from "@/lib/api/library";
import type {
  ArtistMonitoringState,
  MonitoringRules,
} from "@/lib/types/monitoring";

const mockGetMonitoring = getArtistMonitoring as jest.Mock;
const mockSetMonitoring = setArtistMonitoring as jest.Mock;

const MBID = "a74b1b7f-71a5-4011-9441-d0b5e4122711";

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

const OWN_RULES: MonitoringRules = {
  ...DEFAULT_RULES,
  catalog: "latest",
  latestCount: 3,
  types: ["album"],
  topTracks: 10,
};

const state = (
  overrides: Partial<ArtistMonitoringState>,
): ArtistMonitoringState => ({
  added: true,
  monitored: true,
  useDefault: true,
  rules: DEFAULT_RULES,
  defaultRules: DEFAULT_RULES,
  ...overrides,
});

const clients: QueryClient[] = [];

async function renderControl(onChanged = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <ArtistMonitoringControl
        mbid={MBID}
        artistName="Radiohead"
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return onChanged;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("ArtistMonitoringControl", () => {
  it.each([
    ["default rules", state({}), "Monitored"],
    [
      "its own rules",
      state({ useDefault: false, rules: OWN_RULES }),
      "Custom Rules",
    ],
    [
      "no monitoring",
      state({ monitored: false, useDefault: true, rules: null }),
      "Not Monitored",
    ],
  ])("shows an artist on %s", async (_case, monitoring, label) => {
    mockGetMonitoring.mockResolvedValue(monitoring);
    await renderControl();
    expect(await screen.findByLabelText(`Monitoring, ${label}`)).toBeTruthy();
  });

  it.each([
    ["Not Monitored", state({}), { monitored: false }],
    [
      "Default Rules",
      state({ useDefault: false, rules: OWN_RULES }),
      { monitored: true, useDefault: true },
    ],
  ])("switches to %s from the menu", async (item, monitoring, sent) => {
    mockGetMonitoring.mockResolvedValue(monitoring);
    mockSetMonitoring.mockResolvedValue({ monitored: false });
    const onChanged = await renderControl();
    await fireEvent.press(await screen.findByLabelText(item));

    expect(mockSetMonitoring).toHaveBeenCalledWith(MBID, sent);
    expect(onChanged).toHaveBeenCalled();
  });

  it("says what a change queued", async () => {
    mockGetMonitoring.mockResolvedValue(
      state({ monitored: false, rules: null }),
    );
    mockSetMonitoring.mockResolvedValue({
      monitored: true,
      useDefault: true,
      rules: DEFAULT_RULES,
      defaultRules: DEFAULT_RULES,
      monitoring: {
        queued: true,
        releaseGroupIds: ["rg-1", "rg-2"],
        topTracks: [],
      },
    });
    await renderControl();
    await fireEvent.press(await screen.findByLabelText("Default Rules"));

    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Monitoring Radiohead",
        message: "Queued 2 releases",
      }),
    );
  });

  it("edits the artist's own rules, not the defaults", async () => {
    mockGetMonitoring.mockResolvedValue(
      state({ useDefault: false, rules: OWN_RULES }),
    );
    mockSetMonitoring.mockResolvedValue({
      monitored: true,
      useDefault: false,
      rules: { ...OWN_RULES, topTracks: 11 },
      defaultRules: DEFAULT_RULES,
    });
    await renderControl();
    await fireEvent.press(await screen.findByLabelText("Custom Rules…"));
    expect(mockPresent).toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Top Tracks, more"));
    await fireEvent.press(screen.getByText("Save"));

    expect(mockSetMonitoring).toHaveBeenCalledWith(MBID, {
      monitored: true,
      useDefault: false,
      rules: { ...OWN_RULES, topTracks: 11 },
    });
    expect(mockDismiss).toHaveBeenCalled();
  });

  it("only shows the monitoring to someone who can't change it", async () => {
    mockHasPermission.mockImplementation(
      (permission) => permission !== "changeMonitoring",
    );
    mockGetMonitoring.mockResolvedValue(state({}));
    await renderControl();

    expect(await screen.findByLabelText("Monitoring, Monitored")).toBeTruthy();
    expect(screen.queryByLabelText("Not Monitored")).toBeNull();
  });
});
