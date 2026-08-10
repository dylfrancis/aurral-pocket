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

jest.mock("@/hooks/activity/use-activity", () => ({
  useActivitySuspense: jest.fn(),
  useRefreshActivity: jest.fn(() => jest.fn().mockResolvedValue(true)),
}));

jest.mock("@/hooks/activity/use-activity-download-statuses", () => ({
  useActivityDownloadStatuses: jest.fn(() => ({ data: undefined })),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(() => () => false),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  const { View, Pressable, Text } = require("react-native");
  // Rendered rather than stubbed to null, so tests can assert which options
  // the filter menu offers and what choosing one does.
  const Toolbar = Object.assign(
    ({ children }: any) => React.createElement(View, null, children),
    {
      Menu: ({ children, title }: any) =>
        React.createElement(View, { testID: `menu-${title}` }, children),
      MenuAction: ({ children, isOn, onPress }: any) =>
        React.createElement(
          Pressable,
          {
            accessibilityLabel: `option-${children}`,
            accessibilityState: { selected: !!isOn },
            onPress,
          },
          React.createElement(Text, null, children),
        ),
      Button: ({ children }: any) => React.createElement(View, null, children),
    },
  );
  return {
    useFocusEffect: jest.fn(),
    useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
    Stack: { Screen: () => null, Toolbar },
  };
});

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheet = React.forwardRef(function MockBottomSheet(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      close: jest.fn(),
      expand: jest.fn(),
      snapToIndex: jest.fn(),
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetModal: BottomSheet,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@/components/activity/ActivityActionsSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ActivityActionsSheet: function MockActivityActionsSheet() {
      return React.createElement(View, { testID: "activity-actions-sheet" });
    },
  };
});

jest.mock("@/components/library/CoverArtImage", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    CoverArtImage: function MockCoverArtImage() {
      return React.createElement(View, { testID: "cover-art" });
    },
  };
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityList } from "@/components/activity/ActivityList";
import { ActivityErrorBoundary as ErrorBoundary } from "@/components/activity/ActivityErrorBoundary";
import { useActivitySuspense } from "@/hooks/activity/use-activity";
import type { ActivityHistoryItem, AlbumRequest } from "@/lib/types/activity";

const mockUseActivitySuspense = useActivitySuspense as jest.Mock;

function renderWithClient(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

const defaultHook = {
  data: [] as AlbumRequest[],
  refetch: jest.fn().mockResolvedValue({ isError: false }),
  isRefetching: false,
};

function makeRequest(
  overrides: Partial<AlbumRequest> & { id: string },
): AlbumRequest {
  return {
    type: "album",
    albumId: `album-${overrides.id}`,
    albumMbid: `album-mbid-${overrides.id}`,
    albumName: `Album ${overrides.id}`,
    artistId: `artist-${overrides.id}`,
    artistMbid: `artist-mbid-${overrides.id}`,
    artistName: `Artist ${overrides.id}`,
    status: "processing",
    requestedAt: "2026-04-01T00:00:00.000Z",
    mbid: null,
    name: `Request ${overrides.id}`,
    image: null,
    inQueue: false,
    ...overrides,
  };
}

function makeHistoryItem(
  overrides: Partial<ActivityHistoryItem> & { id: string },
): ActivityHistoryItem {
  return {
    type: "activity",
    source: "lidarr",
    kind: "artist_added",
    title: `Added Artist ${overrides.id} to library`,
    subtitle: "Artist added via Lidarr",
    status: "completed",
    statusLabel: "Added",
    requestedAt: "2026-04-02T00:00:00.000Z",
    href: `/artist/mbid-${overrides.id}`,
    playlistId: null,
    jobId: null,
    trackName: null,
    artistName: `Artist ${overrides.id}`,
    albumName: null,
    albumId: null,
    requestedBy: null,
    sourceFilename: null,
    inQueue: false,
    canReSearch: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActivitySuspense.mockReturnValue({ ...defaultHook });
});

describe("ActivityList", () => {
  it("labels each view option with its count from the unfiltered feed", async () => {
    mockUseActivitySuspense.mockReturnValue({
      ...defaultHook,
      data: [
        makeRequest({ id: "1" }),
        makeHistoryItem({ id: "2", status: "blocked", jobId: "job-2" }),
        makeHistoryItem({ id: "3", status: "completed" }),
      ],
    });
    const { getByLabelText, getByTestId } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(getByTestId("menu-View")).toBeTruthy();
    expect(getByLabelText("option-Queue (1)")).toBeTruthy();
    expect(getByLabelText("option-Review (1)")).toBeTruthy();
    expect(getByLabelText("option-History (1)")).toBeTruthy();
  });

  it("marks the current view as selected", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="review" />,
    );
    expect(
      getByLabelText("option-Review").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      getByLabelText("option-Queue").props.accessibilityState.selected,
    ).toBe(false);
  });

  it("replaces the route when a view option is chosen", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    await fireEvent.press(getByLabelText("option-Review"));
    // replace, not push: switching view is a filter, not a journey.
    expect(mockReplace).toHaveBeenCalledWith("/review");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a per-view empty state", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByText } = await renderWithClient(<ActivityList view="queue" />);
    expect(getByText("Queue is empty")).toBeTruthy();
  });

  it("offers no discover CTA on the queue empty state", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { queryByText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(queryByText("Start Discovering")).toBeNull();
  });

  it("offers the discover CTA on the history empty state", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );
    await fireEvent.press(getByText("Start Discovering"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/(discover)");
  });

  it("renders album requests when data is loaded", async () => {
    mockUseActivitySuspense.mockReturnValue({
      ...defaultHook,
      data: [
        makeRequest({ id: "1", albumName: "First Album" }),
        makeRequest({ id: "2", albumName: "Second Album" }),
      ],
    });
    const { getByText } = await renderWithClient(<ActivityList view="queue" />);
    expect(getByText("First Album")).toBeTruthy();
    expect(getByText("Second Album")).toBeTruthy();
  });
  it("shows only queue-eligible items in the queue view", async () => {
    mockUseActivitySuspense.mockReturnValue({
      ...defaultHook,
      data: [
        makeRequest({ id: "1", albumName: "First Album" }),
        // Settled: belongs to History, not Queue.
        makeHistoryItem({ id: "2" }),
        makeHistoryItem({
          id: "3",
          kind: "track_download",
          source: "slskd",
          title: "Downloading Some Track",
          statusLabel: "Downloading",
          status: "processing",
          href: null,
        }),
      ],
    });
    const { getByText, queryByText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(getByText("First Album")).toBeTruthy();
    expect(getByText("Downloading Some Track")).toBeTruthy();
    expect(queryByText("Added Artist 2 to library")).toBeNull();
  });

  it("shows a blocked job in Review with its filename and decisions", async () => {
    mockUseActivitySuspense.mockReturnValue({
      ...defaultHook,
      data: [
        makeHistoryItem({
          id: "blocked-1",
          kind: "track_download",
          title: "Review needed for Some Track",
          status: "blocked",
          statusLabel: "Blocked",
          jobId: "job-1",
          sourceFilename: "Some Track.flac",
          href: null,
        }),
      ],
    });
    const { getByText, getByLabelText } = await renderWithClient(
      <ActivityList view="review" />,
    );
    expect(getByText("Review needed for Some Track")).toBeTruthy();
    // The staged filename is what the user judges the download on.
    expect(getByText("Some Track.flac")).toBeTruthy();
    expect(getByLabelText("Approve download")).toBeTruthy();
    expect(getByLabelText("Deny download")).toBeTruthy();
  });
});

describe("ActivityList ErrorBoundary", () => {
  it("renders the failure message", async () => {
    const { getByText } = await renderWithClient(
      <ErrorBoundary error={new Error("fail")} retry={jest.fn()} />,
    );
    expect(getByText("Failed to load activity")).toBeTruthy();
  });

  it("calls retry when Try Again is pressed", async () => {
    const retry = jest.fn();
    const { getByText } = await renderWithClient(
      <ErrorBoundary error={new Error("fail")} retry={retry} />,
    );
    await fireEvent.press(getByText("Try Again"));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
