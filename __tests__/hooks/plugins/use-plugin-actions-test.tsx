jest.mock("burnt", () => ({ toast: jest.fn() }));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("@/lib/api/plugins", () => ({
  getPluginActions: jest.fn(),
  runPluginAction: jest.fn(),
}));

// The socket's listeners, so a test can send a channel message as Aurral would.
const mockLive: {
  listeners: Set<{
    channel: string;
    types: string[];
    listener: (message: unknown) => void;
  }>;
} = { listeners: new Set() };
jest.mock("@/lib/api/live-socket", () => ({
  subscribeToLiveChannel: (
    channel: string,
    types: string[],
    listener: (message: unknown) => void,
  ) => {
    const entry = { channel, types, listener };
    mockLive.listeners.add(entry);
    return () => mockLive.listeners.delete(entry);
  },
  subscribeToLiveStatus: () => () => {},
  isLiveSocketConnected: () => true,
}));

import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  usePluginActionResults,
  usePluginActions,
} from "@/hooks/plugins/use-plugin-actions";
import { ApiError } from "@/lib/api/client";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import type { PluginAction } from "@/lib/types/plugins";

const mockGetPluginActions = getPluginActions as jest.Mock;
const mockRunPluginAction = runPluginAction as jest.Mock;
const mockToast = Burnt.toast as jest.Mock;

const NOTE_ALBUM: PluginAction = {
  pluginId: "eden",
  pluginName: "Eden",
  id: "album",
  label: "Note this album",
  target: "album",
};
const NOTE_TRACKS: PluginAction = {
  pluginId: "eden",
  pluginName: "Eden",
  id: "track",
  label: "Note these tracks",
  target: "track",
};
// A target this version of pocket has no menu for.
const NOTE_QUEUE: PluginAction = {
  pluginId: "eden",
  pluginName: "Eden",
  id: "queue",
  label: "Note the queue",
  target: "queue",
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderAlbumActions(albumId: string | null = "14") {
  return renderHook(
    () => usePluginActions("album", albumId ? { albumId } : null),
    { wrapper },
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLive.listeners.clear();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  mockGetPluginActions.mockResolvedValue([NOTE_ALBUM, NOTE_TRACKS, NOTE_QUEUE]);
});

afterEach(() => client.clear());

describe("usePluginActions", () => {
  it("offers only its menu's actions, once the record is known", async () => {
    const known = await renderAlbumActions("14");
    const unknown = await renderAlbumActions(null);

    expect(known.result.current.map((item) => item.label)).toEqual([
      "Note this album",
    ]);
    expect(unknown.result.current).toEqual([]);
  });

  it("runs on its record and toasts Aurral's message as the title, even once the menu has closed", async () => {
    const answer = deferred<string>();
    mockRunPluginAction.mockReturnValue(answer.promise);
    const { result, unmount } = await renderAlbumActions("14");

    await act(async () => result.current[0].run());
    await unmount();
    await act(async () => answer.resolve("Eden noted In Rainbows"));

    expect(mockRunPluginAction).toHaveBeenCalledWith(NOTE_ALBUM, {
      albumId: "14",
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "Eden noted In Rainbows",
      message: undefined,
      preset: "done",
    });
  });

  it("shows the action running in every menu for that record until Aurral answers", async () => {
    const answer = deferred<string>();
    mockRunPluginAction.mockReturnValue(answer.promise);
    const albumPage = await renderAlbumActions("14");
    const sameAlbum = await renderAlbumActions("14");
    const otherAlbum = await renderAlbumActions("15");

    await act(async () => albumPage.result.current[0].run());

    expect(sameAlbum.result.current[0].running).toBe(true);
    expect(otherAlbum.result.current[0].running).toBe(false);

    await act(async () => answer.resolve("Done"));

    expect(sameAlbum.result.current[0].running).toBe(false);
  });

  it.each([
    {
      failure: "a plugin's error",
      error: new ApiError(502, "Eden: the box is offline"),
      toast: { title: "Eden: the box is offline", message: undefined },
    },
    {
      failure: "no answer",
      error: new ApiError(0, "Unable to reach server. Check your connection."),
      toast: {
        title: "Couldn't run Note this album",
        message: "Unable to reach server. Check your connection.",
      },
    },
  ])("toasts $failure as an error", async ({ error, toast }) => {
    mockRunPluginAction.mockRejectedValue(error);
    const { result } = await renderAlbumActions("14");

    await act(async () => result.current[0].run());

    expect(mockToast).toHaveBeenCalledWith({ ...toast, preset: "error" });
  });
});

describe("usePluginActionResults", () => {
  it("toasts a background action's result when it finishes", async () => {
    await renderHook(() => usePluginActionResults());

    await act(async () => {
      for (const { channel, types, listener } of mockLive.listeners) {
        if (channel === "plugins" && types.includes("plugin_action_finished")) {
          listener({
            channel: "plugins",
            type: "plugin_action_finished",
            ok: false,
            message: "Eden: the box is offline",
            timestamp: 1,
          });
        }
      }
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Eden: the box is offline",
      message: undefined,
      preset: "error",
    });
  });
});
