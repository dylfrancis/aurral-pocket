jest.mock("@/lib/api/library", () => ({
  cancelAurralAlbum: jest.fn(() => Promise.resolve({ cancelledJobIds: [] })),
  triggerAlbumSearch: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/api/activity", () => ({
  deleteAlbumRequest: jest.fn(() => Promise.resolve({})),
}));

const mockHasPermission = jest.fn((_permission: string) => true);
jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => mockHasPermission,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components/ui/AppSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppSheet: React.forwardRef(function MockAppSheet(
      { children }: any,
      _ref: any,
    ) {
      return React.createElement(View, null, children);
    }),
  };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheetView: ({ children }: any) =>
      React.createElement(View, null, children),
  };
});

import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ActivityActionsSheet } from "@/components/activity/ActivityActionsSheet";
import { deleteAlbumRequest } from "@/lib/api/activity";
import { cancelAurralAlbum } from "@/lib/api/library";
import type { ActivityHistoryItem } from "@/lib/types/activity";

const mockCancelAurralAlbum = cancelAurralAlbum as jest.Mock;
const mockDeleteAlbumRequest = deleteAlbumRequest as jest.Mock;

// Aurral marks the request completed at once; only the album's own status
// says it is still downloading.
const aurralRequest: ActivityHistoryItem = {
  id: "aurral-album_requested-12",
  type: "activity",
  source: "aurral",
  kind: "album_requested",
  title: "Requested Kid A",
  subtitle: "Radiohead",
  status: "completed",
  statusLabel: "Requested",
  requestedAt: "2026-11-09T00:00:00.000Z",
  href: "/artist/radiohead-mbid",
  playlistId: null,
  jobId: null,
  trackName: null,
  artistName: "Radiohead",
  albumName: "Kid A",
  albumId: "12",
  canonicalAlbumId: "12",
  requestedBy: null,
  sourceFilename: null,
  inQueue: false,
  canReSearch: false,
};

async function openSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ActivityActionsSheet
        sheetRef={React.createRef<BottomSheetModal>()}
        request={aurralRequest}
        downloadStatus="downloading"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission.mockReturnValue(true);
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ActivityActionsSheet", () => {
  it("stops an Aurral album by cancelling its downloads, not by dismissing the request", async () => {
    await openSheet();

    await act(async () => {
      fireEvent.press(screen.getByText("Stop Download"));
    });

    expect(mockCancelAurralAlbum).toHaveBeenCalledWith("12");
    expect(mockDeleteAlbumRequest).not.toHaveBeenCalled();
  });

  it("offers Stop on an Aurral album only to a user who can add albums", async () => {
    // Lidarr's Stop takes deleteAlbum; Aurral's cancel route takes addAlbum.
    mockHasPermission.mockImplementation(
      (permission) => permission === "deleteAlbum",
    );
    await openSheet();

    expect(screen.queryByText("Stop Download")).toBeNull();
  });
});
