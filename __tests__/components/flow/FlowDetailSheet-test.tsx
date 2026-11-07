let mockFlow: Record<string, unknown> | undefined;
const mockMutation = { mutate: jest.fn(), isPending: false };

jest.mock("@/hooks/flow", () => ({
  useFlow: jest.fn(() => mockFlow),
  useFlowStats: jest.fn(() => undefined),
  useJobsForPlaylist: jest.fn(() => []),
  usePlaylistJobs: jest.fn(() => ({ isLoading: false })),
  useFlowStatus: jest.fn(() => ({ data: undefined })),
  useFlowAudioPreview: jest.fn(() => ({ stop: jest.fn() })),
  useSetFlowEnabled: jest.fn(() => mockMutation),
  useStartFlow: jest.fn(() => mockMutation),
  useDeleteFlow: jest.fn(() => mockMutation),
  useConvertFlowToStaticPlaylist: jest.fn(() => mockMutation),
}));

jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: jest.fn(() => ({
    track: null,
    open: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    FlashList: ({ renderScrollComponent, ...props }: any) =>
      React.createElement(FlatList, props),
  };
});

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
    useBottomSheetScrollableCreator: () => undefined,
  };
});

import React from "react";
import { Alert } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { FlowDetailSheet } from "@/components/flow/FlowDetailSheet";
import { useFlowStats, useFlowStatus } from "@/hooks/flow";

const FLOW = {
  id: "flow-1",
  name: "Shoegaze Essentials",
  enabled: false,
  size: 30,
  mix: { discover: 50, mix: 30, trending: 20, focus: 0, newReleases: 0 },
  deepDive: false,
  recentListening: false,
  tags: [],
  excludeTags: [],
  relatedArtists: [],
  scheduleDays: [1],
  scheduleTime: "00:00",
  nextRunAt: null,
};

const sheetRef = { current: null } as any;

function renderSheet() {
  return render(
    <FlowDetailSheet sheetRef={sheetRef} flowId="flow-1" onClose={jest.fn()} />,
  );
}

describe("FlowDetailSheet", () => {
  it("offers Start and the enable switch, and no retry-cycle action, on a flow", async () => {
    mockFlow = FLOW;

    const { getByText, queryByText } = await renderSheet();

    expect(getByText("Start Now")).toBeTruthy();
    expect(getByText("Enabled")).toBeTruthy();
    expect(queryByText(/Retry/)).toBeNull();
  });

  describe("converting to a static playlist", () => {
    it.each([
      ["no playlist has the name", [], "Shoegaze Essentials Static"],
      [
        "the name is taken, in any case",
        ["shoegaze essentials static"],
        "Shoegaze Essentials Static 2",
      ],
      [
        "the numbered name is taken too",
        ["Shoegaze Essentials Static", "Shoegaze Essentials Static 2"],
        "Shoegaze Essentials Static 3",
      ],
    ])("picks the name when %s", async (_case, taken, expected) => {
      mockFlow = FLOW;
      mockMutation.mutate.mockClear();
      (useFlowStats as jest.Mock).mockReturnValueOnce({ done: 1 });
      (useFlowStatus as jest.Mock).mockReturnValueOnce({
        data: { sharedPlaylists: taken.map((name) => ({ name })) },
      });
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

      const { getByText } = await renderSheet();
      await fireEvent.press(getByText("Convert to Static"));
      alert.mock.calls[0][2]?.[1].onPress?.();

      expect(mockMutation.mutate).toHaveBeenCalledWith({
        flowId: "flow-1",
        name: expected,
      });
      alert.mockRestore();
    });
  });
});
