jest.mock("@/lib/api/library", () => ({
  cancelAurralAlbum: jest.fn(() => Promise.resolve({ cancelledJobIds: [] })),
}));

jest.mock("@/lib/api/flow", () => ({
  cancelTrackJob: jest.fn(),
  retryTrackJob: jest.fn(() =>
    Promise.resolve({ jobId: "j1", status: "pending" }),
  ),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: 7, role: "user", permissions: {} } }),
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
import { retryTrackJob } from "@/lib/api/flow";
import { cancelAurralAlbum } from "@/lib/api/library";
import type { ActivityItem } from "@/lib/types/activity";
import type { DownloadStatusValue } from "@/lib/types/library";

const mockCancelAurralAlbum = cancelAurralAlbum as jest.Mock;

// Aurral marks the request completed at once; only the album's own status
// says it is still downloading.
const aurralRequest: ActivityItem = {
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
  libraryAlbumId: "12",
  requestedBy: null,
  sourceFilename: null,
  upgrade: null,
  inQueue: false,
};

const failedDownload: ActivityItem = {
  ...aurralRequest,
  id: "aurral-track_download-j1",
  kind: "track_download",
  title: "Failed Idioteque",
  subtitle: "Radiohead · Chill",
  status: "failed",
  statusLabel: "Failed",
  href: null,
  playlistId: "flow-1",
  jobId: "j1",
  trackName: "Idioteque",
  albumName: null,
  libraryAlbumId: null,
};

// Aurral's paged feed merges an album's track downloads into one row whose
// own status is live, and which the download status map doesn't cover.
const albumDownload: ActivityItem = {
  ...aurralRequest,
  id: "grab-1",
  kind: "album_download",
  title: "Kid A",
  status: "processing",
  statusLabel: "Downloading album",
  inQueue: true,
  progressLabel: "3 of 10 tracks ready",
};

async function openSheet(
  request: ActivityItem = aurralRequest,
  sheetRef = React.createRef<BottomSheetModal>(),
  downloadStatus: DownloadStatusValue | undefined = "downloading",
) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ActivityActionsSheet
        sheetRef={sheetRef}
        request={request}
        downloadStatus={downloadStatus}
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
  it("stops a requested album by cancelling its downloads", async () => {
    await openSheet();

    await act(async () => {
      fireEvent.press(screen.getByText("Stop Download"));
    });

    expect(mockCancelAurralAlbum).toHaveBeenCalledWith("12");
  });

  it.each([
    ["while it downloads", albumDownload, true],
    [
      "not once it settles",
      { ...albumDownload, status: "completed", inQueue: false },
      false,
    ],
  ])("offers Stop on an album download %s", async (_name, item, offered) => {
    await openSheet(item, undefined, undefined);

    if (!offered) {
      expect(screen.queryByText("Stop Download")).toBeNull();
      return;
    }
    await act(async () => {
      fireEvent.press(screen.getByText("Stop Download"));
    });
    expect(mockCancelAurralAlbum).toHaveBeenCalledWith("12");
  });

  it("offers Stop on an album only to a user who can add albums", async () => {
    // The cancel route takes addAlbum, so deleteAlbum alone is not enough.
    mockHasPermission.mockImplementation(
      (permission) => permission === "deleteAlbum",
    );
    await openSheet();

    expect(screen.queryByText("Stop Download")).toBeNull();
  });

  it("retries a failed track download under its track name, then closes", async () => {
    const dismiss = jest.fn();
    await openSheet(failedDownload, {
      current: { dismiss } as unknown as BottomSheetModal,
    });
    expect(screen.getByText("Idioteque")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Retry Download"));
    });

    expect(retryTrackJob).toHaveBeenCalledWith("j1");
    expect(dismiss).toHaveBeenCalled();
  });
});
