jest.mock("@/lib/api/activity", () => ({
  getActivityPage: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: () => true,
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ACTIVITY_PAGE_SIZE,
  useActivityCounts,
  useActivityPages,
} from "@/hooks/activity/use-activity";
import { getActivityPage } from "@/lib/api/activity";
import type { ActivityView } from "@/lib/activity-views";
import type { ActivityItem, ActivityPage } from "@/lib/types/activity";

const mockGetActivityPage = getActivityPage as jest.Mock;

function row(id: string): ActivityItem {
  return {
    id,
    type: "activity",
    source: "aurral",
    kind: "track_download",
    title: `Downloading ${id}`,
    subtitle: null,
    status: "pending",
    statusLabel: "Queued",
    requestedAt: "2026-11-17T00:00:00.000Z",
    href: null,
    playlistId: "flow-1",
    jobId: id,
    trackName: id,
    artistName: null,
    albumName: null,
    libraryAlbumId: null,
    requestedBy: null,
    sourceFilename: null,
    upgrade: null,
    inQueue: true,
  };
}

function page(
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

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockGetActivityPage.mockReset();
  mockGetActivityPage.mockResolvedValue(page([]));
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
});

describe("useActivityPages", () => {
  it.each<[ActivityView, object]>([
    ["queue", { view: "queue", status: "failed", cause: "flow:flow-1" }],
    // Review is the queue's tracks awaiting review, whatever pill was left on.
    ["review", { view: "queue", status: "review", cause: "flow:flow-1" }],
    // Only the queue has causes.
    ["history", { view: "history", status: "failed", cause: null }],
  ])("asks for %s's first page from the server", async (view, expected) => {
    await renderHook(
      () => useActivityPages(view, { status: "failed", cause: "flow:flow-1" }),
      { wrapper },
    );

    await waitFor(() =>
      expect(mockGetActivityPage).toHaveBeenCalledWith({
        ...expected,
        offset: 0,
        limit: ACTIVITY_PAGE_SIZE,
        refresh: false,
      }),
    );
  });

  it("reads on from where the rows end, until it has them all", async () => {
    // A row that arrived between reads pushes "b" onto the second page too.
    mockGetActivityPage
      .mockResolvedValueOnce(
        page([row("a"), row("b")], { total: 3, matching: 3 }),
      )
      .mockResolvedValueOnce(
        page([row("b"), row("c")], { total: 3, matching: 3 }),
      );
    const { result } = await renderHook(
      () => useActivityPages("queue", { status: null, cause: null }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => result.current.loadMore());
    await waitFor(() =>
      expect(result.current.items.map((item) => item.id)).toEqual([
        "a",
        "b",
        "c",
      ]),
    );
    expect(mockGetActivityPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 2 }),
    );

    await act(async () => result.current.loadMore());
    expect(mockGetActivityPage).toHaveBeenCalledTimes(2);
  });

  it("rebuilds Aurral's cache only for a pull-to-refresh", async () => {
    const { result } = await renderHook(
      () => useActivityPages("queue", { status: null, cause: null }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.page).toBeDefined());

    await act(async () => {
      await result.current.refresh();
    });
    expect(mockGetActivityPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ refresh: true }),
    );

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetActivityPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ refresh: false }),
    );
  });

  it("keeps what it showed when a filter fails to load", async () => {
    const { result, rerender } = await renderHook(
      ({ cause }: { cause: string | null }) =>
        useActivityPages("queue", { status: null, cause }),
      { wrapper, initialProps: { cause: null as string | null } },
    );
    await waitFor(() => expect(result.current.page).toBeDefined());
    mockGetActivityPage.mockRejectedValue(new Error("offline"));

    await rerender({ cause: "flow:flow-1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useActivityCounts", () => {
  it("counts each view, with Review's tracks inside the queue's", async () => {
    mockGetActivityPage.mockImplementation(async ({ view }) =>
      view === "queue"
        ? page([], {
            total: 5,
            filters: [
              { id: "queued", label: "Queued", count: 3 },
              { id: "review", label: "Review", count: 2 },
            ],
          })
        : page([], { view: "history", total: 40 }),
    );
    const { result } = await renderHook(() => useActivityCounts(), { wrapper });

    await waitFor(() =>
      expect(result.current).toEqual({ queue: 5, review: 2, history: 40 }),
    );
  });
});
