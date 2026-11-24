jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));

// The menus and switch are SwiftUI or Compose. A menu stands in as a group
// named like the native one, holding a button per choice, and the switch as
// one button.
jest.mock("@/components/settings/SettingsPicker", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    SettingsPicker: ({ accessibilityLabel, options, onChange }: any) =>
      React.createElement(
        View,
        { accessibilityLabel },
        options.map((option: any) =>
          React.createElement(
            Pressable,
            {
              key: option.value,
              accessibilityLabel: option.label,
              onPress: () => onChange(option.value),
            },
            React.createElement(Text, null, option.label),
          ),
        ),
      ),
  };
});
jest.mock("@/components/settings/SettingsSwitch", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    SettingsSwitch: ({ value, onChange }: any) =>
      React.createElement(Pressable, {
        accessibilityRole: "switch",
        accessibilityState: { checked: value },
        onPress: () => onChange(!value),
      }),
  };
});

const mockClearAudioCache = jest.fn(() => Promise.resolve());
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/offline/audio-cache", () => ({
  useCachedBytes: () => 84_000_000,
  clearAudioCache: () => mockClearAudioCache(),
}));
const mockSetFavoritesSave = jest.fn((_mode: string | null) =>
  Promise.resolve(),
);
jest.mock("@/lib/offline/saved-library", () => ({
  useSavedBytes: () => 2_400_000_000,
  useFavoritesSave: () => null,
  setFavoritesSave: (mode: string | null) => mockSetFavoritesSave(mode),
}));

import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render as renderScreen,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { PlaybackStorageScreen } from "@/components/settings/PlaybackStorageScreen";
import { TranscodingProfileScreen } from "@/components/settings/TranscodingProfileScreen";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  getPlaybackSettings,
  setPlaybackSettings,
} from "@/lib/player/playback-settings";
import { libraryKeys } from "@/lib/query-keys";
import { serverSort } from "@/lib/library-sorts";

let queryClient = new QueryClient();
function render(element: React.ReactElement) {
  return renderScreen(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // No gc timer, which a seeded read would otherwise leave running.
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => setPlaybackSettings(DEFAULT_PLAYBACK_SETTINGS));
});

describe("PlaybackStorageScreen", () => {
  it("stores each choice in its own setting", async () => {
    await render(<PlaybackStorageScreen />);

    const choose = (menu: string, choice: string) =>
      fireEvent.press(
        within(screen.getByLabelText(menu)).getByLabelText(choice),
      );
    await choose("Prefetch Ahead", "3 Tracks");
    await choose("Queue Length", "50 Tracks");
    await choose("Cache Size", "2 GB");
    // Prefer Lossless on Wi-Fi, Wi-Fi Only, Autoplay, Level Loud Tracks, then
    // Keep Screen On with Lyrics.
    await fireEvent.press(screen.getAllByRole("switch")[1]);
    await fireEvent.press(screen.getAllByRole("switch")[2]);
    await fireEvent.press(screen.getAllByRole("switch")[3]);
    await fireEvent.press(screen.getAllByRole("switch")[4]);

    expect(getPlaybackSettings()).toEqual({
      prefetchAhead: 3,
      queueLimit: 50,
      cacheBytes: 2_000_000_000,
      wifiOnly: true,
      autoplay: false,
      levelLoudTracks: false,
      keepScreenOnWithLyrics: false,
      transcoding: DEFAULT_PLAYBACK_SETTINGS.transcoding,
    });
    expect(screen.getAllByRole("switch")[1]).toBeChecked();
    expect(screen.getAllByRole("switch")[2]).not.toBeChecked();
    expect(screen.getAllByRole("switch")[3]).not.toBeChecked();
    expect(screen.getAllByRole("switch")[4]).not.toBeChecked();
  });

  it("sets the cellular format, bitrate and lossless rule independently of Wi-Fi", async () => {
    await render(<TranscodingProfileScreen network="cellular" />);
    const choose = (menu: string, choice: string) =>
      fireEvent.press(
        within(screen.getByLabelText(menu)).getByLabelText(choice),
      );
    await choose("Transcode Format", "AAC");
    await choose("Bitrate", "96 kbps");
    await fireEvent.press(screen.getByRole("switch"));

    expect(getPlaybackSettings().transcoding).toEqual({
      ...DEFAULT_PLAYBACK_SETTINGS.transcoding,
      cellular: { format: "aac", kbps: 96, losslessOnly: true },
    });
  });

  it("asks before Save Favorites saves, saying how much it adds", async () => {
    queryClient.setQueryData(
      libraryKeys.favoriteLists(serverSort("favorited")),
      {
        artists: [],
        albums: [],
        tracks: [
          { id: "1", streamPath: "/library/stream/4/1", size: 40_000_000 },
          { id: "2", streamPath: "/library/stream/4/2", size: 60_000_000 },
        ],
      },
    );
    await render(<PlaybackStorageScreen />);

    await fireEvent.press(
      within(screen.getByLabelText("Save Favorites")).getByLabelText("Songs"),
    );
    expect(mockSetFavoritesSave).not.toHaveBeenCalled();
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe("Save Favorites Offline?");
    expect(message).toBe(
      "2 songs, about 100 MB. Songs you favorite later are saved too.",
    );

    await act(async () =>
      buttons
        .find((button: { text: string }) => button.text === "Save")
        .onPress(),
    );
    expect(mockSetFavoritesSave).toHaveBeenCalledWith("songs");
  });

  it("sizes favorite albums from their tracks, counting a favorite song on one once", async () => {
    const onAlbum = (id: string, size: number) => ({
      id,
      streamPath: `/library/stream/8/${id}`,
      size,
    });
    queryClient.setQueryData(
      libraryKeys.favoriteLists(serverSort("favorited")),
      {
        artists: [],
        // Library album rows carry no size.
        albums: [{ id: "8", canonicalId: "8", statistics: { sizeOnDisk: 0 } }],
        tracks: [onAlbum("1", 40_000_000)],
      },
    );
    queryClient.setQueryData(libraryKeys.tracks("8"), [
      onAlbum("1", 40_000_000),
      onAlbum("2", 60_000_000),
    ]);
    await render(<PlaybackStorageScreen />);

    await fireEvent.press(
      within(screen.getByLabelText("Save Favorites")).getByLabelText(
        "Songs and Albums",
      ),
    );

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
      "1 song and 1 album, about 100 MB. Songs and albums you favorite later are saved too.",
    );
  });

  it("shows what the cache and saves take, and clears the cache", async () => {
    await render(<PlaybackStorageScreen />);

    expect(screen.getByText("84 MB")).toBeTruthy();
    expect(screen.getByText("2.4 GB")).toBeTruthy();

    await fireEvent.press(screen.getByText("Clear Cache"));

    expect(mockClearAudioCache).toHaveBeenCalledTimes(1);
  });
});
