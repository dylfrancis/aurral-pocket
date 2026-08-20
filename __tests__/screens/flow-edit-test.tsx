jest.mock("@/lib/api/flow", () => ({
  getFlowStatus: jest.fn(),
  createFlow: jest.fn(),
  updateFlow: jest.fn(),
  deleteFlow: jest.fn(),
  setFlowEnabled: jest.fn(),
  startFlow: jest.fn(),
  convertFlowToStaticPlaylist: jest.fn(),
  updateSharedPlaylist: jest.fn(),
  deleteSharedPlaylist: jest.fn(),
  deleteSharedPlaylistTrack: jest.fn(),
  setRetryCyclePaused: jest.fn(),
  getWorkerSettings: jest.fn(),
  updateWorkerSettings: jest.fn(),
  getFlowStreamSource: jest.fn(),
  getFlowArtworkSource: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({ serverUrl: "http://test", token: "token" })),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: jest.fn(() => ({})),
  useAudioPlayerStatus: jest.fn(() => ({})),
}));

jest.mock("expo-localization", () => ({
  getCalendars: jest.fn(() => [{ uses24hourClock: true }]),
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ back: mockBack, push: jest.fn() })),
}));

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: jest.fn(() => true),
}));

// The native wheel is replaced with a prop-transparent View so tests can read
// selectedValue and drive onValueChange directly.
jest.mock("@react-native-picker/picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Picker = function MockPicker({ children, ...props }: any) {
    return React.createElement(
      View,
      { ...props, testID: "hour-picker" },
      children,
    );
  };
  Picker.Item = function MockPickerItem() {
    return null;
  };
  return { Picker };
});

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { updateFlow } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type { Flow, FlowStatusSnapshot } from "@/lib/types/flow";
import FlowEditScreen from "@/app/(app)/(tabs)/(flow)/flow-edit";

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUpdateFlow = updateFlow as jest.Mock;

const flow: Flow = {
  id: "flow-1",
  name: "Morning Mix",
  enabled: true,
  size: 30,
  mix: { discover: 50, mix: 30, trending: 20, focus: 0 },
  deepDive: false,
  tags: [],
  relatedArtists: [],
  scheduleDays: [1, 3],
  scheduleTime: "09:00",
  nextRunAt: null,
};

const status = {
  flows: [flow],
  sharedPlaylists: [],
  jobs: [],
} as unknown as FlowStatusSnapshot;

async function renderScreen(flowOverrides?: Partial<Flow>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      // Unmounting the screen arms a gc timer per mutation, and React Query's
      // default of 5 minutes outlives the test and stops Jest from exiting.
      // Infinity (as above for queries) is skipped rather than scheduled, but
      // mutations need a real cache entry here, so use 0 to let it fire at once.
      mutations: { gcTime: 0 },
    },
  });
  client.setQueryData(
    flowKeys.status(),
    flowOverrides
      ? { ...status, flows: [{ ...flow, ...flowOverrides }] }
      : status,
  );
  const utils = await render(
    <QueryClientProvider client={client}>
      <FlowEditScreen />
    </QueryClientProvider>,
  );
  return { client, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ id: "flow-1" });
});

describe("FlowEditScreen (editing)", () => {
  it("hydrates the form from the cached flow", async () => {
    const { getByTestId, getByDisplayValue } = await renderScreen();

    expect(getByTestId("hour-picker").props.selectedValue).toBe(9);
    expect(getByDisplayValue("Morning Mix")).toBeTruthy();
  });

  it("keeps the draft when fresh status data lands in the cache (#138)", async () => {
    const { client, getByTestId, getByDisplayValue } = await renderScreen();

    await act(() => {
      getByTestId("hour-picker").props.onValueChange(14);
    });
    expect(getByTestId("hour-picker").props.selectedValue).toBe(14);

    // Simulate a 3s status poll delivering server-side changes mid-edit.
    await act(() => {
      client.setQueryData(flowKeys.status(), {
        ...status,
        flows: [{ ...flow, name: "Renamed Elsewhere", scheduleTime: "07:00" }],
      });
    });

    expect(getByTestId("hour-picker").props.selectedValue).toBe(14);
    expect(getByDisplayValue("Morning Mix")).toBeTruthy();
  });

  it("saves the edited schedule time", async () => {
    mockUpdateFlow.mockResolvedValue({ ...flow, scheduleTime: "14:00" });
    const { getByTestId, getByText } = await renderScreen();

    await act(() => {
      getByTestId("hour-picker").props.onValueChange(14);
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ scheduleTime: "14:00" }),
      ),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("preserves recordHistory through an unrelated edit (#198)", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: 0 },
      },
    });
    client.setQueryData(flowKeys.status(), {
      ...status,
      flows: [{ ...flow, recordHistory: true }],
    });
    mockUpdateFlow.mockResolvedValue({ ...flow, recordHistory: true });
    const { getByTestId, getByText } = await render(
      <QueryClientProvider client={client}>
        <FlowEditScreen />
      </QueryClientProvider>,
    );

    await act(() => {
      getByTestId("hour-picker").props.onValueChange(14);
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ recordHistory: true, scheduleTime: "14:00" }),
      ),
    );
  });

  it("seeds recordHistory as enabled when the server omits it", async () => {
    mockUpdateFlow.mockResolvedValue(flow);
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ recordHistory: true }),
      ),
    );
  });

  it("saves recordHistory turned off", async () => {
    mockUpdateFlow.mockResolvedValue({ ...flow, recordHistory: false });
    const { getByText, getAllByRole } = await renderScreen();

    // Two switches render, in tree order: Deep Dive, then Record History.
    const switches = getAllByRole("switch");
    expect(switches).toHaveLength(2);
    await act(() => {
      fireEvent(switches[1], "valueChange", false);
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ recordHistory: false }),
      ),
    );
  });

  it("hydrates the year range from the cached flow", async () => {
    const { getByTestId, getByText } = await renderScreen({
      yearFrom: 1990,
      yearTo: 1999,
    });

    expect(getByTestId("year-from-input").props.value).toBe("1990");
    expect(getByTestId("year-to-input").props.value).toBe("1999");
    expect(getByText("Releases from 1990 to 1999.")).toBeTruthy();
  });

  it("describes an open range when the flow has no year bounds", async () => {
    const { getByTestId, getByText } = await renderScreen();

    expect(getByTestId("year-from-input").props.value).toBe("");
    expect(getByTestId("year-to-input").props.value).toBe("");
    expect(getByText("Any release year.")).toBeTruthy();
  });

  // The form posts both bounds on every save, so an unseeded field would send
  // null and wipe a range set on another client (#207).
  it("resends the stored year range when an unrelated field changes", async () => {
    mockUpdateFlow.mockResolvedValue(flow);
    const { getByTestId, getByText } = await renderScreen({
      yearFrom: 1990,
      yearTo: 1999,
    });

    await act(() => {
      getByTestId("hour-picker").props.onValueChange(14);
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({
          scheduleTime: "14:00",
          yearFrom: 1990,
          yearTo: 1999,
        }),
      ),
    );
  });

  it("saves an edited year range", async () => {
    mockUpdateFlow.mockResolvedValue(flow);
    const { getByTestId, getByText } = await renderScreen();

    await act(() => {
      fireEvent.changeText(getByTestId("year-from-input"), "1975");
    });
    await act(() => {
      fireEvent.changeText(getByTestId("year-to-input"), "1985");
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ yearFrom: 1975, yearTo: 1985 }),
      ),
    );
  });

  it("clears the range by sending null for an emptied bound", async () => {
    mockUpdateFlow.mockResolvedValue(flow);
    const { getByTestId, getByText } = await renderScreen({
      yearFrom: 1990,
      yearTo: 1999,
    });

    await act(() => {
      fireEvent.changeText(getByTestId("year-from-input"), "");
    });
    await act(() => {
      fireEvent.changeText(getByTestId("year-to-input"), "");
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateFlow).toHaveBeenCalledWith(
        "flow-1",
        expect.objectContaining({ yearFrom: null, yearTo: null }),
      ),
    );
  });

  it("drops non-digits from a year bound", async () => {
    const { getByTestId } = await renderScreen();

    await act(() => {
      fireEvent.changeText(getByTestId("year-from-input"), "19a9-0");
    });

    expect(getByTestId("year-from-input").props.value).toBe("1990");
  });

  it("blocks the save when the range is inverted", async () => {
    const { getByTestId, getByText } = await renderScreen();

    await act(() => {
      fireEvent.changeText(getByTestId("year-from-input"), "1999");
    });
    await act(() => {
      fireEvent.changeText(getByTestId("year-to-input"), "1990");
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(
        getByText("To year must not be before the from year"),
      ).toBeTruthy(),
    );
    expect(mockUpdateFlow).not.toHaveBeenCalled();
  });

  it("blocks the save when a bound is not a 4-digit year", async () => {
    const { getByTestId, getByText } = await renderScreen();

    await act(() => {
      fireEvent.changeText(getByTestId("year-from-input"), "199");
    });
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(getByText("Year must have 4 digits")).toBeTruthy(),
    );
    expect(mockUpdateFlow).not.toHaveBeenCalled();
  });

  it("shows a not-found state when the flow is missing from the cache", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "missing-flow" });
    const { getByText } = await renderScreen();

    expect(getByText("Flow not found.")).toBeTruthy();
  });
});
