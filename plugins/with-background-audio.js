const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Native config the audio engine needs to keep playing in the background.
 *
 * iOS: the "audio" background mode. Without it the system stops playback the
 * moment the app leaves the foreground.
 *
 * Android: a foreground service of type mediaPlayback. FOREGROUND_SERVICE is
 * required from API 28. FOREGROUND_SERVICE_MEDIA_PLAYBACK is required from
 * API 34, which refuses to start a media service without it. WAKE_LOCK keeps
 * the processor awake while the screen is off.
 */

const ANDROID_PLAYBACK_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK",
];

/** Add the audio background mode without dropping modes another plugin set. */
function addAudioBackgroundMode(infoPlist) {
  const modes = infoPlist.UIBackgroundModes || [];
  if (modes.includes("audio")) return infoPlist;
  infoPlist.UIBackgroundModes = [...modes, "audio"];
  return infoPlist;
}

const withBackgroundAudio = (config) => {
  config = withInfoPlist(config, (cfg) => {
    addAudioBackgroundMode(cfg.modResults);
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(
      cfg.modResults,
      ANDROID_PLAYBACK_PERMISSIONS,
    );
    return cfg;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withBackgroundAudio,
  "with-background-audio",
  "1.0.0",
);
module.exports.ANDROID_PLAYBACK_PERMISSIONS = ANDROID_PLAYBACK_PERMISSIONS;
module.exports.addAudioBackgroundMode = addAudioBackgroundMode;
