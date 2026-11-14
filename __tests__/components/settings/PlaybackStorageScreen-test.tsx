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
jest.mock("@/lib/offline/audio-cache", () => ({
  useCachedBytes: () => 84_000_000,
  clearAudioCache: () => mockClearAudioCache(),
}));
jest.mock("@/lib/offline/saved-library", () => ({
  useSavedBytes: () => 2_400_000_000,
}));

import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { PlaybackStorageScreen } from "@/components/settings/PlaybackStorageScreen";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  getPlaybackSettings,
  setPlaybackSettings,
} from "@/lib/player/playback-settings";

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
    await fireEvent.press(screen.getByRole("switch"));

    expect(getPlaybackSettings()).toEqual({
      prefetchAhead: 3,
      queueLimit: 50,
      cacheBytes: 2_000_000_000,
      wifiOnly: true,
    });
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("shows what the cache and saves take, and clears the cache", async () => {
    await render(<PlaybackStorageScreen />);

    expect(screen.getByText("84 MB")).toBeTruthy();
    expect(screen.getByText("2.4 GB")).toBeTruthy();

    await fireEvent.press(screen.getByText("Clear Cache"));

    expect(mockClearAudioCache).toHaveBeenCalledTimes(1);
  });
});
