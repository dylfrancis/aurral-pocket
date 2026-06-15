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

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(flowKeys.status(), status);
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

  it("shows a not-found state when the flow is missing from the cache", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "missing-flow" });
    const { getByText } = await renderScreen();

    expect(getByText("Flow not found.")).toBeTruthy();
  });
});
