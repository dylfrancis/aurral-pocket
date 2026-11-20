// jest-expo 57's generated ExpoObserve mock predates expo-image's observe
// integration, so it has no getIntegrations() — which expo-image calls at import
// time, crashing any suite that imports it. expo-observe isn't a dependency here,
// so drop the module and let the integration no-op like it does on device.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NativeModulesProxy } = require("expo-modules-core");
delete (NativeModulesProxy as Record<string, unknown>).ExpoObserve;

// The generated ExpoUI mock has no getMaterialColors, which @expo/ui's Compose
// Host calls as it renders. Stack.Toolbar renders through that Host on Android,
// so a suite with a real header crashes under the Android preset without this.
(
  NativeModulesProxy as Record<string, Record<string, unknown>>
).ExpoUI.getMaterialColors = () => ({});

// React Query defers observer notifications behind a setTimeout(0), so an update
// can land after the test that caused it has finished and its act() scope has
// closed — surfacing as "not wrapped in act(...)" noise under a full suite run.
// Flushing synchronously keeps every notification inside the caller's act().
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("@tanstack/react-query").notifyManager.setScheduler(
  (callback: () => void) => callback(),
);

jest.mock("expo/fetch", () => ({
  fetch: jest.fn(),
}));

// The track menu is native SwiftUI or Compose, which can't render under Jest.
// It stands in as a group labelled like its trigger, holding a plain button per
// action that carries the action's title, then one per plugin action.
jest.mock("@/components/player/TrackMenu", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const button = (key: string, title: string, onPress: () => void) =>
    React.createElement(
      Pressable,
      { key, accessibilityLabel: title, onPress },
      React.createElement(Text, null, title),
    );
  return {
    TrackMenu: ({
      actions,
      onAction,
      pluginActions = [],
      accessibilityLabel,
    }: any) =>
      React.createElement(
        View,
        { accessibilityLabel: accessibilityLabel ?? "More actions" },
        actions.map((action: any) =>
          button(action.id, action.title, () => onAction(action.id)),
        ),
        pluginActions.map((action: any) =>
          button(action.key, action.label, action.run),
        ),
      ),
  };
});

// The devices menu is native too. It stands in the same way: a group labelled
// like its trigger, holding a plain button for the device to pick up from.
jest.mock("@/components/player/DevicesMenu", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    DevicesMenu: ({ device, onPickUp, accessibilityLabel }: any) =>
      React.createElement(
        View,
        { accessibilityLabel },
        device &&
          React.createElement(
            Pressable,
            { accessibilityLabel: device.name, onPress: onPickUp },
            React.createElement(Text, null, device.name),
            React.createElement(Text, null, device.detail),
          ),
      ),
  };
});

// The edition picker is a native menu as well. It stands in as a group
// labelled "Edition", holding a plain button per edition named by it.
jest.mock("@/components/library/EditionPicker", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    EditionPicker: ({ editions, selectedId, onSelect }: any) =>
      React.createElement(
        View,
        { accessibilityLabel: "Edition" },
        editions.map((edition: any) =>
          React.createElement(
            Pressable,
            {
              key: edition.id,
              accessibilityLabel: edition.name,
              accessibilityState: { selected: edition.id === selectedId },
              onPress: () => onSelect(edition.id),
            },
            React.createElement(Text, null, edition.name),
          ),
        ),
      ),
  };
});

// The artist's library capsule is a native menu too. It stands in as a group
// labelled like the capsule, holding a plain button per monitoring choice
// (when it can change) and one for Remove from Library.
jest.mock("@/components/artist/ArtistLibraryCapsule", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const {
    REMOVE_FROM_LIBRARY,
    libraryCapsuleAccessibilityLabel,
  } = require("@/components/artist/artist-library-capsule-types");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const items = [
    ["default", "Default Rules"],
    ["custom", "Custom Rules…"],
    ["off", "Not Monitored"],
  ];
  const button = (
    key: string,
    title: string,
    onPress: () => void,
    selected?: boolean,
  ) =>
    React.createElement(
      Pressable,
      {
        key,
        accessibilityLabel: title,
        accessibilityState: selected === undefined ? undefined : { selected },
        onPress,
      },
      React.createElement(Text, null, title),
    );
  return {
    ArtistLibraryCapsule: ({ choice, onSelect, onRemove }: any) =>
      React.createElement(
        View,
        { accessibilityLabel: libraryCapsuleAccessibilityLabel(choice) },
        onSelect && choice
          ? items.map(([value, title]) =>
              button(value, title, () => onSelect(value), value === choice),
            )
          : null,
        onRemove ? button("remove", REMOVE_FROM_LIBRARY, onRemove) : null,
      ),
  };
});

// The menu picker and stepper in a sheet's rows are SwiftUI or Compose. The
// picker stands in as a group labelled like it, holding a button per option;
// the stepper as a pair of buttons, "<label>, fewer" and "<label>, more".
jest.mock("@/components/ui/MenuPicker", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    MenuPicker: ({ accessibilityLabel, value, options, onChange }: any) =>
      React.createElement(
        View,
        { accessibilityLabel },
        options.map((option: any) =>
          React.createElement(
            Pressable,
            {
              key: option.value,
              accessibilityLabel: option.label,
              accessibilityState: { selected: option.value === value },
              onPress: () => onChange(option.value),
            },
            React.createElement(Text, null, option.label),
          ),
        ),
      ),
  };
});

jest.mock("@/components/ui/NumberStepper", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { Pressable, View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    NumberStepper: ({ accessibilityLabel, value, min, max, onChange }: any) =>
      React.createElement(
        View,
        null,
        React.createElement(Pressable, {
          accessibilityLabel: `${accessibilityLabel}, fewer`,
          onPress: () => onChange(Math.max(min, value - 1)),
        }),
        React.createElement(Pressable, {
          accessibilityLabel: `${accessibilityLabel}, more`,
          onPress: () => onChange(Math.min(max, value + 1)),
        }),
      ),
  };
});

// AsyncStorage has no native module under Jest, and it throws at import time.
// `lib/storage` reaches many modules indirectly, so install the mock the library
// ships. Suites that assert on storage calls still mock it themselves.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The native ShazamKit module isn't linked under Jest; default to "unavailable"
// so importers are safe. The hook test overrides this with a controllable mock.
jest.mock("@/modules/shazam", () => ({
  isShazamAvailable: false,
  startListening: jest.fn(() => Promise.resolve()),
  stopListening: jest.fn(() => Promise.resolve()),
  addMatchListener: jest.fn(() => null),
  addNoMatchListener: jest.fn(() => null),
  addErrorListener: jest.fn(() => null),
  addLevelListener: jest.fn(() => null),
}));

// Saved-offline files live in memory. A test drives each download by hand
// through test-support/expo-file-system.
jest.mock("expo-file-system", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/test-support/expo-file-system"),
);

// Online unless a test says otherwise.
jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(() =>
    Promise.resolve({
      type: "WIFI",
      isConnected: true,
      isInternetReachable: true,
    }),
  ),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  NetworkStateType: { NONE: "NONE", WIFI: "WIFI", CELLULAR: "CELLULAR" },
}));

// The cover-color module isn't linked under Jest.
jest.mock("react-native-image-colors", () => ({
  getColors: jest.fn(() => Promise.reject(new Error("not linked"))),
}));

// The audio engine builds its native objects at import time, which throws
// under Jest. Mock the whole module so any importer is safe. The player facade
// test drives these same functions.
jest.mock("react-native-nitro-player", () => ({
  PlayerQueue: {
    createPlaylist: jest.fn(() => Promise.resolve("playlist-1")),
    deletePlaylist: jest.fn(() => Promise.resolve()),
    getAllPlaylists: jest.fn(() => []),
    addTracksToPlaylist: jest.fn(() => Promise.resolve()),
    loadPlaylist: jest.fn(() => Promise.resolve()),
    reorderTrackInPlaylist: jest.fn(() => Promise.resolve()),
    removeTracksFromPlaylist: jest.fn(() => Promise.resolve()),
  },
  TrackPlayer: {
    configure: jest.fn(() => Promise.resolve()),
    playSong: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    skipToNext: jest.fn(() => Promise.resolve()),
    skipToPrevious: jest.fn(() => Promise.resolve()),
    seek: jest.fn(() => Promise.resolve()),
    setRepeatMode: jest.fn(() => Promise.resolve()),
    setVolume: jest.fn(() => Promise.resolve()),
    updateTracks: jest.fn(() => Promise.resolve()),
    onTracksNeedUpdate: jest.fn(),
    setNotificationButtonState: jest.fn(),
    getState: jest.fn(() =>
      Promise.resolve({
        currentTrack: null,
        currentPosition: 0,
        totalDuration: 0,
        currentState: "stopped",
        currentPlaylistId: null,
        currentIndex: -1,
        currentPlayingType: "not-playing",
      }),
    ),
  },
  useNowPlaying: jest.fn(() => ({
    currentTrack: null,
    currentPosition: 0,
    totalDuration: 0,
    currentState: "stopped",
    currentPlaylistId: null,
    currentIndex: -1,
    currentPlayingType: "not-playing",
  })),
  // No car is available unless a test says so.
  CarPlayHelper: {
    isAvailable: jest.fn(() => false),
    set: jest.fn(),
    setTemplateLoader: jest.fn(),
    onSelect: jest.fn(),
    showNowPlaying: jest.fn(),
    reload: jest.fn(),
    popToRoot: jest.fn(),
  },
  AndroidAutoMediaLibraryHelper: {
    isAvailable: jest.fn(() => false),
    set: jest.fn(),
    setChildrenLoader: jest.fn(),
    setSearchHandler: jest.fn(),
    onPlaybackResumption: jest.fn(),
  },
}));

// The player facade deep-imports the engine's callback manager (see
// lib/player/player.ts). Under Jest that path resolves to the real file — and
// the real native engine behind it — so it is mocked separately here.
jest.mock("react-native-nitro-player/src/hooks/callbackManager", () => ({
  callbackManager: {
    subscribeToTrackChange: jest.fn(() => () => {}),
    subscribeToPlaybackState: jest.fn(() => () => {}),
    subscribeToPlaybackProgressChange: jest.fn(() => () => {}),
    subscribeToNotificationButtonPress: jest.fn(() => () => {}),
  },
}));

jest.mock("burnt", () => ({
  toast: jest.fn(),
  alert: jest.fn(),
  dismissAllAlerts: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  const createIconMock = () => {
    const Icon = ({ name, testID, ...props }: any) =>
      React.createElement(View, { ...props, testID: testID ?? `icon-${name}` });
    Icon.displayName = "MockIcon";
    return Icon;
  };

  return {
    Ionicons: createIconMock(),
    MaterialIcons: createIconMock(),
    FontAwesome: createIconMock(),
  };
});
