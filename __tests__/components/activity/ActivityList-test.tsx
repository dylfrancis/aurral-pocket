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
  useActivityPages: jest.fn(),
  useActivityCounts: jest.fn(),
}));

jest.mock("@/hooks/activity/use-activity-download-statuses", () => ({
  useActivityDownloadStatuses: jest.fn(() => ({ data: undefined })),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(() => () => false),
}));

const mockUser = { id: 7, role: "user", permissions: {} };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api/flow", () => ({
  getFlowStatus: jest.fn(),
  updateWorkerSettings: jest.fn(),
}));

jest.mock("@/lib/api/activity", () => ({
  cancelQueuedDownloads: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockIsFocused = jest.fn(() => true);
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
      Button: () => null,
    },
  );
  return {
    useFocusEffect: jest.fn(),
    useNavigation: () => ({ isFocused: mockIsFocused }),
    useRouter: jest.fn(() => ({
      push: mockPush,
      replace: mockReplace,
      navigate: mockNavigate,
    })),
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

const mockActivityActionsSheet = jest.fn();
jest.mock("@/components/activity/ActivityActionsSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ActivityActionsSheet: function MockActivityActionsSheet(props: any) {
      mockActivityActionsSheet(props);
      return React.createElement(View, { testID: "activity-actions-sheet" });
    },
  };
});

// The real pills are SwiftUI and Compose views.
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
              accessibilityRole: "tab",
              accessibilityLabel: `${item.label} ${item.count}`,
              accessibilityState: { selected: item.id === selected },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, `${item.label} ${item.count}`),
          ),
        ),
      ),
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
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityList } from "@/components/activity/ActivityList";
import { ActivityErrorBoundary as ErrorBoundary } from "@/components/activity/ActivityErrorBoundary";
import { Alert } from "react-native";
import {
  useActivityCounts,
  useActivityPages,
} from "@/hooks/activity/use-activity";
import { useActivityDownloadStatuses } from "@/hooks/activity/use-activity-download-statuses";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { cancelQueuedDownloads } from "@/lib/api/activity";
import { getFlowStatus, updateWorkerSettings } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type {
  ActivityCauseGroup,
  ActivityItem,
  ActivityPage,
} from "@/lib/types/activity";

const mockUseActivityPages = useActivityPages as jest.Mock;
const mockUseActivityCounts = useActivityCounts as jest.Mock;
const mockUseActivityDownloadStatuses =
  useActivityDownloadStatuses as jest.Mock;
const mockUseHasPermission = useHasPermission as jest.Mock;
const mockGetFlowStatus = getFlowStatus as jest.Mock;

const clients: QueryClient[] = [];

function makeClient() {
  const client = new QueryClient({
    // A settled mutation's five-minute gc timer would hold Jest open.
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  return client;
}

// A query fetched outside a component arms a five-minute gc timer that would
// hold Jest open. Unmount first, or cleanup re-arms what clear() just dropped.
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

function renderWithClient(
  node: React.ReactElement,
  queryClient = makeClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

function makePage(
  items: ActivityItem[],
  overrides: Partial<ActivityPage> = {},
): ActivityPage {
  return {
    view: "queue",
    items,
    causes: [],
    cause: null,
    total: items.length,
    matching: items.length,
    filters: [],
    cancelable: 0,
    paused: false,
    ...overrides,
  };
}

function pagesResult(page: ActivityPage) {
  return {
    items: page.items,
    page,
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    refresh: jest.fn().mockResolvedValue({ isError: false }),
    loadMore: jest.fn(),
  };
}

/** What the server answers for every view and filter. */
function showPage(
  items: ActivityItem[] = [],
  overrides: Partial<ActivityPage> = {},
) {
  mockUseActivityPages.mockReturnValue(pagesResult(makePage(items, overrides)));
}

/** The filters the screen last asked the server for. */
function lastFilter() {
  return mockUseActivityPages.mock.lastCall?.[1];
}

function makeHistoryItem(
  overrides: Partial<ActivityItem> & { id: string },
): ActivityItem {
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
    libraryAlbumId: null,
    requestedBy: null,
    sourceFilename: null,
    upgrade: null,
    inQueue: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  showPage();
  mockUseActivityCounts.mockReturnValue(undefined);
  mockUser.role = "user";
  mockUseActivityDownloadStatuses.mockReturnValue({ data: undefined });
});

describe("ActivityList", () => {
  it("labels each view option with its count", async () => {
    mockUseActivityCounts.mockReturnValue({ queue: 2, review: 1, history: 1 });
    const { getByLabelText, getByTestId } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(getByTestId("menu-View")).toBeTruthy();
    expect(getByLabelText("option-Queue (2)")).toBeTruthy();
    expect(getByLabelText("option-Review (1)")).toBeTruthy();
    expect(getByLabelText("option-History (1)")).toBeTruthy();
  });

  it("marks the current view as selected", async () => {
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
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    await fireEvent.press(getByLabelText("option-Review"));
    // replace, not push: switching view is a filter, not a journey.
    expect(mockReplace).toHaveBeenCalledWith("/review");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a per-view empty state", async () => {
    const { getByText } = await renderWithClient(<ActivityList view="queue" />);
    expect(getByText("Queue is empty")).toBeTruthy();
  });

  it("offers no discover CTA on the queue empty state", async () => {
    const { queryByText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(queryByText("Start Discovering")).toBeNull();
  });

  it("offers the discover CTA on the history empty state", async () => {
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );
    await fireEvent.press(getByText("Start Discovering"));
    expect(mockNavigate).toHaveBeenCalledWith("/(app)/(tabs)/(discover)");
  });

  it("shows an Aurral request its album's status over its own", async () => {
    mockUseActivityDownloadStatuses.mockReturnValue({
      data: { "12": { status: "queued" } },
    });
    showPage([
      makeHistoryItem({
        id: "aurral-request",
        kind: "album_requested",
        source: "aurral",
        title: "Requested Kid A",
        statusLabel: "Requested",
        libraryAlbumId: "12",
      }),
    ]);
    const { getByText, queryByText } = await renderWithClient(
      <ActivityList view="history" />,
    );
    expect(getByText("Queued")).toBeTruthy();
    expect(queryByText("Requested")).toBeNull();
  });

  it("opens the actions for an Aurral request while its album downloads", async () => {
    mockUseHasPermission.mockReturnValue(() => true);
    mockUseActivityDownloadStatuses.mockReturnValue({
      data: { "12": { status: "downloading" } },
    });
    const request = makeHistoryItem({
      id: "aurral-request",
      kind: "album_requested",
      source: "aurral",
      title: "Requested Kid A",
      albumName: "Kid A",
      libraryAlbumId: "12",
    });
    showPage([request]);
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent(getByText("Requested Kid A"), "longPress");

    expect(mockActivityActionsSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ request, downloadStatus: "downloading" }),
    );
  });

  it("opens the actions for a failed track download", async () => {
    mockUseHasPermission.mockReturnValue(() => true);
    const download = makeHistoryItem({
      id: "aurral-track_download-j1",
      kind: "track_download",
      source: "aurral",
      title: "Failed Track One",
      status: "failed",
      statusLabel: "Failed",
      jobId: "j1",
      playlistId: "flow-1",
      trackName: "Track One",
    });
    showPage([download]);
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent(getByText("Failed Track One"), "longPress");

    expect(mockActivityActionsSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ request: download }),
    );
  });

  it("shows a blocked job in Review with its filename and decisions", async () => {
    // Review reads the queue, so the server sends the queue's filters too.
    showPage(
      [
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
      { filters: [{ id: "review", label: "Review", count: 1 }] },
    );
    const { getByText, getByLabelText, queryAllByRole } =
      await renderWithClient(<ActivityList view="review" />);
    expect(queryAllByRole("tab")).toHaveLength(0);
    expect(getByText("Review needed for Some Track")).toBeTruthy();
    // The staged filename is what the user judges the download on.
    expect(getByText("Some Track.flac")).toBeTruthy();
    expect(getByLabelText("Approve download")).toBeTruthy();
    expect(getByLabelText("Deny download")).toBeTruthy();
  });

  it("opens an artist row with the artist's name", async () => {
    // An artist since removed from the library opens the Browse page, whose
    // title comes from the route.
    showPage([makeHistoryItem({ id: "3" })]);
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText("Added Artist 3 to library"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[mbid]",
      params: { mbid: "mbid-3", name: "Artist 3" },
    });
  });
});

describe("ActivityList playlist rows", () => {
  const FLOWS_TAB = "/(app)/(tabs)/(flow)";
  const LIBRARY_PLAYLISTS = "/(app)/(tabs)/(library)/playlists";
  const STATUS = {
    flows: [{ id: "flow-1", name: "Chill" }],
    staticPlaylists: [{ id: "pl-1", name: "Road Trip" }],
  };
  const TITLE = "Downloading Some Track";

  function showRow(playlistId: string, overrides: Partial<ActivityItem> = {}) {
    showPage([
      makeHistoryItem({
        id: "1",
        kind: "track_download",
        source: "slskd",
        title: TITLE,
        status: "completed",
        href: `/playlists?selected=${playlistId}`,
        playlistId,
        ...overrides,
      }),
    ]);
  }

  beforeEach(() => {
    mockUseHasPermission.mockReturnValue(() => true);
    mockGetFlowStatus.mockResolvedValue(STATUS);
    mockIsFocused.mockReturnValue(true);
  });

  afterEach(() => {
    mockUseHasPermission.mockReturnValue(() => false);
  });

  it.each([
    ["a flow", "flow-1", FLOWS_TAB],
    ["a static playlist", "pl-1", LIBRARY_PLAYLISTS],
    ["an id the server no longer knows", "gone", LIBRARY_PLAYLISTS],
  ])("opens the right list for %s", async (_name, playlistId, route) => {
    showRow(playlistId);
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText(TITLE));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(route));
  });

  it("falls back to Library > Playlists when the lookup fails", async () => {
    mockGetFlowStatus.mockRejectedValue(new Error("offline"));
    showRow("flow-1");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText(TITLE));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(LIBRARY_PLAYLISTS),
    );
  });

  it("answers from a snapshot that already knows the id", async () => {
    const client = makeClient();
    client.setQueryData(flowKeys.status(), STATUS);
    showRow("flow-1");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
      client,
    );

    await fireEvent.press(getByText(TITLE));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(FLOWS_TAB));
    expect(mockGetFlowStatus).not.toHaveBeenCalled();
  });

  it("asks the server when the snapshot predates the id", async () => {
    const client = makeClient();
    client.setQueryData(flowKeys.status(), {
      flows: [],
      staticPlaylists: [],
    });
    showRow("flow-1");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
      client,
    );

    await fireEvent.press(getByText(TITLE));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(FLOWS_TAB));
  });

  it("doesn't pull back someone who left while the lookup ran", async () => {
    let finishLookup: (status: typeof STATUS) => void = () => {};
    mockGetFlowStatus.mockReturnValue(
      new Promise((resolve) => {
        finishLookup = resolve;
      }),
    );
    showRow("flow-1");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText(TITLE));
    mockIsFocused.mockReturnValue(false);
    await act(async () => finishLookup(STATUS));

    expect(mockGetFlowStatus).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a blocked row in place, around its inline decisions", async () => {
    showRow("flow-1", { status: "blocked", jobId: "job-1" });
    const { getByText, getByLabelText } = await renderWithClient(
      <ActivityList view="review" />,
    );
    expect(getByLabelText("Approve download")).toBeTruthy();

    await fireEvent.press(getByText(TITLE));

    expect(mockGetFlowStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("stays inert without accessPlaylists, and requests nothing", async () => {
    mockUseHasPermission.mockReturnValue(() => false);
    showRow("flow-1");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText(TITLE));

    expect(mockGetFlowStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("stays inert for an album download's reserved library id", async () => {
    showRow("library");
    const { getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText(TITLE));

    expect(mockGetFlowStatus).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("ActivityList status filters", () => {
  function track(
    id: string,
    overrides: Partial<ActivityItem> = {},
  ): ActivityItem {
    return makeHistoryItem({
      id,
      kind: "track_download",
      source: "slskd",
      title: `Track ${id}`,
      href: null,
      ...overrides,
    });
  }

  const pillLabels = (getAllByRole: (role: "tab") => any[]) =>
    getAllByRole("tab").map((pill) => pill.props.accessibilityLabel);

  const HISTORY_FILTERS = [
    { id: "downloaded" as const, label: "Downloaded", count: 1 },
    { id: "upgraded" as const, label: "Upgraded", count: 1 },
    { id: "failed" as const, label: "Failed", count: 0 },
    { id: "cancelled" as const, label: "Cancelled", count: 0 },
  ];

  it("offers the server's statuses and asks it for the chosen one", async () => {
    showPage([track("downloaded"), track("upgraded")], {
      view: "history",
      filters: HISTORY_FILTERS,
    });
    const { getAllByRole, getByText } = await renderWithClient(
      <ActivityList view="history" />,
    );
    expect(pillLabels(getAllByRole)).toEqual([
      "All 2",
      "Downloaded 1",
      "Upgraded 1",
      "Failed 0",
      "Cancelled 0",
    ]);
    expect(lastFilter()).toEqual({ status: null, cause: null });

    await fireEvent.press(getByText("Upgraded 1"));

    expect(lastFilter()).toEqual({ status: "upgraded", cause: null });
  });

  it("says nothing matches a status with no rows, without the discover CTA", async () => {
    const all = makePage([track("downloaded")], {
      view: "history",
      filters: HISTORY_FILTERS,
    });
    mockUseActivityPages.mockImplementation((_view, { status }) =>
      pagesResult(status ? { ...all, items: [], matching: 0 } : all),
    );
    const { getByText, queryByText } = await renderWithClient(
      <ActivityList view="history" />,
    );

    await fireEvent.press(getByText("Cancelled 0"));

    expect(getByText("No matches")).toBeTruthy();
    expect(queryByText("Start Discovering")).toBeNull();
  });

  it("marks an upgrade with the quality it replaced, and where tracks came from", async () => {
    showPage([
      track("tidarr", {
        source: "tidarr",
        upgrade: { fromQuality: "MP3 320" },
      }),
      track("share", { source: "share" }),
      track("qbittorrent", { source: "qbittorrent" }),
      // Aurral reads a plugin download as "unknown"; only a track of an
      // album download keeps the plugin's id.
      track("plugin", {
        source: "unknown",
        actualDownloadSource: "plugin:bandcamp",
      }),
      track("unknown", { source: "unknown", upgrade: { fromQuality: null } }),
    ]);
    const { getByText, getAllByText } = await renderWithClient(
      <ActivityList view="history" />,
    );
    expect(getByText("Upgrade from MP3 320")).toBeTruthy();
    expect(getByText("Quality upgrade")).toBeTruthy();
    expect(getByText(/ · Tidarr$/)).toBeTruthy();
    expect(getByText(/ · Aurral share$/)).toBeTruthy();
    expect(getByText(/ · qBittorrent$/)).toBeTruthy();
    expect(getByText(/ · bandcamp plugin$/)).toBeTruthy();
    expect(getAllByText(/ · /)).toHaveLength(4);
  });
});

describe("ActivityList queue", () => {
  const FLOW_CAUSE: ActivityCauseGroup = {
    kind: "flow",
    playlistId: "flow-1",
    name: "Discover Weekly",
    syncedFrom: null,
    key: "flow:flow-1",
    count: 2,
    since: "2026-11-15T12:00:00.000Z",
  };
  const MONITORING_CAUSE: ActivityCauseGroup = {
    kind: "monitoring",
    playlistId: null,
    name: null,
    syncedFrom: null,
    key: "monitoring",
    count: 1,
    since: "2026-11-15T12:00:00.000Z",
    subject: "Radiohead",
    subjects: 1,
  };
  const queued = makeHistoryItem({
    id: "q1",
    kind: "track_download",
    title: "Queued Idioteque",
    status: "pending",
    statusLabel: "Queued",
    jobId: "j1",
    playlistId: "flow-1",
    href: null,
    inQueue: true,
  });

  /** The server answers with the cause it applied, as Aurral does. */
  function serveQueue(overrides: Partial<ActivityPage> = {}) {
    const page = makePage([queued], {
      causes: [FLOW_CAUSE, MONITORING_CAUSE],
      cancelable: 3,
      ...overrides,
    });
    mockUseActivityPages.mockImplementation((_view, { cause }) =>
      pagesResult({
        ...page,
        cause,
        cancelable: cause ? FLOW_CAUSE.count : page.cancelable,
      }),
    );
  }

  const causeCard = (getByLabelText: (label: RegExp) => any, title: string) =>
    getByLabelText(new RegExp(`^${title}, `));

  // Confirms whatever the alert asks, and keeps what it asked.
  let alerts: { title: string | null | undefined; message?: string | null }[] =
    [];
  beforeEach(() => {
    alerts = [];
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      alerts.push({ title, message });
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    (cancelQueuedDownloads as jest.Mock).mockResolvedValue({
      cancelled: 0,
      cleanupFailed: false,
    });
    (updateWorkerSettings as jest.Mock).mockResolvedValue({
      concurrency: 1,
      paused: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows why downloads are queued, and filters to one cause", async () => {
    serveQueue();
    const { getByLabelText, getByText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(getByText("flow refresh")).toBeTruthy();
    expect(getByText("new music from Radiohead")).toBeTruthy();

    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));
    expect(lastFilter()).toEqual({ status: null, cause: "flow:flow-1" });
    expect(
      causeCard(getByLabelText, "Discover Weekly").props.accessibilityState,
    ).toEqual({ selected: true });

    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));
    expect(lastFilter()).toEqual({ status: null, cause: null });
  });

  it("clears a cause tapped twice before its page arrives", async () => {
    // The previous page stays up while the chosen cause's loads.
    mockUseActivityPages.mockImplementation(() => ({
      ...pagesResult(makePage([queued], { causes: [FLOW_CAUSE] })),
      isPlaceholderData: true,
    }));
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );

    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));
    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));

    expect(lastFilter()).toEqual({ status: null, cause: null });
  });

  it("keeps the screen and offers a retry when a filter fails to load", async () => {
    const result = { ...pagesResult(makePage([])), isError: true };
    mockUseActivityPages.mockReturnValue(result);
    const { getByText } = await renderWithClient(<ActivityList view="queue" />);

    await fireEvent.press(getByText("Try Again"));

    expect(result.refetch).toHaveBeenCalled();
  });

  it("lets a cause go once Aurral no longer has it queued", async () => {
    serveQueue();
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    // The group's downloads finished: the server ignores its key.
    mockUseActivityPages.mockImplementation(() =>
      pagesResult(makePage([], { causes: [MONITORING_CAUSE] })),
    );

    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));

    expect(lastFilter()).toEqual({ status: null, cause: null });
  });

  it("leaves the causes to Queue, though Review reads the queue too", async () => {
    serveQueue();
    const { queryByText } = await renderWithClient(
      <ActivityList view="review" />,
    );
    expect(queryByText("flow refresh")).toBeNull();
    expect(queryByText(/^Cancel /)).toBeNull();
  });

  it("tells everyone the queue is paused, and offers a user nothing to do about it", async () => {
    serveQueue({ paused: true, cancelable: 0 });
    const { getByText, queryByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    expect(
      getByText(
        "Downloads are paused. Tracks already downloading will finish.",
      ),
    ).toBeTruthy();
    expect(queryByLabelText("option-Resume Queue")).toBeNull();
    expect(queryByLabelText(/^option-Cancel /)).toBeNull();
  });

  it.each([
    [false, "Pause Queue", true],
    [true, "Resume Queue", false],
  ])(
    "lets an admin flip a queue that's paused=%s",
    async (paused, action, next) => {
      mockUser.role = "admin";
      serveQueue({ paused });
      const { getByLabelText } = await renderWithClient(
        <ActivityList view="queue" />,
      );

      await fireEvent.press(getByLabelText(`option-${action}`));

      await waitFor(() =>
        expect(updateWorkerSettings).toHaveBeenCalledWith({ paused: next }),
      );
    },
  );

  it("cancels every download the user may cancel, once confirmed", async () => {
    serveQueue();
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );

    await fireEvent.press(getByLabelText("option-Cancel All (3)…"));

    expect(alerts).toEqual([
      {
        title: "Cancel all downloads?",
        message: "3 downloads will stop. You can retry each one from History.",
      },
    ]);
    await waitFor(() =>
      expect(cancelQueuedDownloads).toHaveBeenCalledWith(null),
    );
  });

  it("cancels only the chosen cause's downloads", async () => {
    serveQueue();
    const { getByLabelText } = await renderWithClient(
      <ActivityList view="queue" />,
    );
    await fireEvent.press(causeCard(getByLabelText, "Discover Weekly"));

    await fireEvent.press(getByLabelText("option-Cancel Discover Weekly (2)…"));

    expect(alerts[0]?.title).toBe("Cancel Discover Weekly downloads?");
    await waitFor(() =>
      expect(cancelQueuedDownloads).toHaveBeenCalledWith("flow:flow-1"),
    );
  });

  it("shows an album download as one row with its progress", async () => {
    mockUseHasPermission.mockReturnValue(() => true);
    const album = makeHistoryItem({
      id: "grab-1",
      kind: "album_download",
      source: "aurral",
      title: "Kid A",
      subtitle: "Radiohead · Everything in Its Right Place",
      status: "processing",
      statusLabel: "Downloading album",
      artistName: "Radiohead",
      albumName: "Kid A",
      libraryAlbumId: "12",
      href: null,
      inQueue: true,
      progressLabel: "3 of 10 tracks ready",
    });
    showPage([album]);
    const { getByText } = await renderWithClient(<ActivityList view="queue" />);
    expect(getByText("Radiohead · 3 of 10 tracks ready")).toBeTruthy();

    await fireEvent(getByText("Kid A"), "longPress");

    expect(mockActivityActionsSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ request: album }),
    );
    mockUseHasPermission.mockReturnValue(() => false);
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
