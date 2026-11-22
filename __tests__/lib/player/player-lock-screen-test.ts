jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { IS_IOS } from "@/constants/platform";
import {
  onLockScreenFavoritePress,
  setLockScreenFavorite,
} from "@/lib/player/player";
import { TrackPlayer, type TrackItem } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

const engineTrack: TrackItem = {
  id: "77",
  title: "Karma Police",
  artist: "Radiohead",
  album: "OK Computer",
  duration: 264,
  url: "http://server/api/library/stream/12/77?token=token",
};

function starConfigs() {
  return player.configure.mock.calls
    .map(([config]) => config)
    .filter((config) => config.notificationButtons);
}

it("shows the star once, sets each track's state on it, and hides it", async () => {
  setLockScreenFavorite({ trackId: "77", isFavorite: true });
  setLockScreenFavorite({ trackId: "78", isFavorite: false });
  setLockScreenFavorite(null);
  await new Promise((resolve) => setImmediate(resolve));

  // Android's notification has no star, so nothing reaches its engine.
  expect(starConfigs()).toEqual(
    IS_IOS
      ? [
          {
            notificationButtons: {
              ios: {
                lockScreen: [
                  { id: "favorite", command: "like", title: "Favorite" },
                ],
              },
            },
          },
          { notificationButtons: { ios: { lockScreen: [] } } },
        ]
      : [],
  );
  expect(player.setNotificationButtonState.mock.calls).toEqual(
    IS_IOS
      ? [
          [{ buttonId: "favorite", trackIds: ["77"], isActive: true }],
          [{ buttonId: "favorite", trackIds: ["78"], isActive: false }],
        ]
      : [],
  );
});

it("passes on taps of the star alone, with the state they gave it", () => {
  const heard = jest.fn();
  const stop = onLockScreenFavoritePress(heard);
  const press = manager.subscribeToNotificationButtonPress.mock.calls[0][0];

  press("favorite", engineTrack, { isActive: true });
  press("shuffle", engineTrack, { isActive: true });
  stop();
  press("favorite", engineTrack, { isActive: false });

  expect(heard.mock.calls).toEqual([[{ trackId: "77", isFavorite: true }]]);
});
