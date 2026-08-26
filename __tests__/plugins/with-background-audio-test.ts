const {
  ANDROID_PLAYBACK_PERMISSIONS,
  addAudioBackgroundMode,
} = require("@/plugins/with-background-audio");

describe("addAudioBackgroundMode", () => {
  it("lets iOS keep playing once the app leaves the foreground", () => {
    expect(addAudioBackgroundMode({}).UIBackgroundModes).toEqual(["audio"]);
  });

  it("keeps the background modes another plugin already added", () => {
    const plist = { UIBackgroundModes: ["fetch"] };

    expect(addAudioBackgroundMode(plist).UIBackgroundModes).toEqual([
      "fetch",
      "audio",
    ]);
  });

  it("does not add the audio mode twice", () => {
    const plist = { UIBackgroundModes: ["audio"] };

    expect(addAudioBackgroundMode(plist).UIBackgroundModes).toEqual(["audio"]);
  });
});

describe("ANDROID_PLAYBACK_PERMISSIONS", () => {
  it("asks for the media playback service that Android 14 requires", () => {
    // Android 14 refuses to start a media foreground service without this
    // permission, so playback would die the moment the screen locks.
    expect(ANDROID_PLAYBACK_PERMISSIONS).toEqual([
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.WAKE_LOCK",
    ]);
  });
});
