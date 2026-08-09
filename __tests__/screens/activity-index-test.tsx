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
jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

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
    ActivityActionsSheet: function MockRequestActionsSheet() {
      return React.createElement(View, { testID: "request-actions-sheet" });
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
import ActivityScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(activity)/index";
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

describe("ActivityScreen", () => {
  it("shows empty state when the feed is empty", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByText } = await renderWithClient(<ActivityScreen />);
    expect(getByText("No activity yet")).toBeTruthy();
  });

  it("navigates to discover when empty state action is pressed", async () => {
    mockUseActivitySuspense.mockReturnValue({ ...defaultHook, data: [] });
    const { getByText } = await renderWithClient(<ActivityScreen />);
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
    const { getByText } = await renderWithClient(<ActivityScreen />);
    expect(getByText("First Album")).toBeTruthy();
    expect(getByText("Second Album")).toBeTruthy();
  });
  it("renders history entries alongside album requests", async () => {
    mockUseActivitySuspense.mockReturnValue({
      ...defaultHook,
      data: [
        makeRequest({ id: "1", albumName: "First Album" }),
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
    const { getByText } = await renderWithClient(<ActivityScreen />);
    expect(getByText("First Album")).toBeTruthy();
    expect(getByText("Added Artist 2 to library")).toBeTruthy();
    expect(getByText("Downloading Some Track")).toBeTruthy();
    // Server-rendered label wins over any status wording Pocket would derive.
    expect(getByText("Added")).toBeTruthy();
  });
});

describe("ActivityScreen ErrorBoundary", () => {
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
