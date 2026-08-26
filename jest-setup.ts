// jest-expo 57's generated ExpoObserve mock predates expo-image's observe
// integration, so it has no getIntegrations() — which expo-image calls at import
// time, crashing any suite that imports it. expo-observe isn't a dependency here,
// so drop the module and let the integration no-op like it does on device.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NativeModulesProxy } = require("expo-modules-core");
delete (NativeModulesProxy as Record<string, unknown>).ExpoObserve;

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

// The audio engine builds its native objects at import time, which throws
// under Jest. Mock the whole module so any importer is safe. The player facade
// test drives these same functions.
jest.mock("react-native-nitro-player", () => ({
  PlayerQueue: {
    createPlaylist: jest.fn(() => Promise.resolve("playlist-1")),
    deletePlaylist: jest.fn(() => Promise.resolve()),
    addTracksToPlaylist: jest.fn(() => Promise.resolve()),
    loadPlaylist: jest.fn(() => Promise.resolve()),
    reorderTrackInPlaylist: jest.fn(() => Promise.resolve()),
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
}));

// The player facade deep-imports the engine's callback manager (see
// lib/player/player.ts). Under Jest that path resolves to the real file — and
// the real native engine behind it — so it is mocked separately here.
jest.mock("react-native-nitro-player/src/hooks/callbackManager", () => ({
  callbackManager: {
    subscribeToTrackChange: jest.fn(() => () => {}),
    subscribeToPlaybackState: jest.fn(() => () => {}),
    subscribeToPlaybackProgressChange: jest.fn(() => () => {}),
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
