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

jest.mock("@/hooks/requests/use-requests", () => ({
  useRequests: jest.fn(),
}));

jest.mock("@/hooks/requests/use-requests-download-statuses", () => ({
  useRequestsDownloadStatuses: jest.fn(() => ({ data: undefined })),
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
    }));
    return React.createElement(View, props, children);
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@/components/requests/RequestActionsSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    RequestActionsSheet: function MockRequestActionsSheet() {
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
import RequestsScreen from "@/app/(app)/(tabs)/(requests)/index";
import { useRequests } from "@/hooks/requests/use-requests";
import type { Request } from "@/lib/types/requests";

const mockUseRequests = useRequests as jest.Mock;

const defaultRequestsHook = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({}),
};

function makeRequest(overrides: Partial<Request> & { id: string }): Request {
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRequests.mockReturnValue({ ...defaultRequestsHook });
});

describe("RequestsScreen", () => {
  it("shows loading indicator while requests are loading", () => {
    mockUseRequests.mockReturnValue({
      ...defaultRequestsHook,
      isLoading: true,
    });
    const { UNSAFE_getByType } = render(<RequestsScreen />);
    const { ActivityIndicator } = require("react-native");
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("shows error state with retry button when requests fail to load", () => {
    const refetch = jest.fn();
    mockUseRequests.mockReturnValue({
      ...defaultRequestsHook,
      error: new Error("fail"),
      refetch,
    });
    const { getByText } = render(<RequestsScreen />);
    expect(getByText("Failed to load requests")).toBeTruthy();
    fireEvent.press(getByText("Try Again"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no requests exist", () => {
    mockUseRequests.mockReturnValue({
      ...defaultRequestsHook,
      data: [],
    });
    const { getByText } = render(<RequestsScreen />);
    expect(getByText("No requests yet")).toBeTruthy();
  });

  it("navigates to discover when empty state action is pressed", () => {
    mockUseRequests.mockReturnValue({
      ...defaultRequestsHook,
      data: [],
    });
    const { getByText } = render(<RequestsScreen />);
    fireEvent.press(getByText("Start Discovering"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/(discover)");
  });

  it("renders requests list when data is loaded", () => {
    mockUseRequests.mockReturnValue({
      ...defaultRequestsHook,
      data: [
        makeRequest({ id: "1", albumName: "First Album" }),
        makeRequest({ id: "2", albumName: "Second Album" }),
      ],
    });
    const { getByText } = render(<RequestsScreen />);
    expect(getByText("First Album")).toBeTruthy();
    expect(getByText("Second Album")).toBeTruthy();
  });
});
