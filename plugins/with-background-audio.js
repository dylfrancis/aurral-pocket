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
 *
 * The Nitro player's manifest also asks for FOREGROUND_SERVICE_DATA_SYNC, for
 * its offline-download worker. Pocket never downloads to the device, so the
 * permission is stripped from the merged manifest: Google Play makes every
 * foreground service type the app declares demonstrable in review. Put it back
 * if Pocket starts using the player's downloads.
 */

const ANDROID_PLAYBACK_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK",
];

const ANDROID_BLOCKED_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
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

  config = AndroidConfig.Permissions.withBlockedPermissions(
    config,
    ANDROID_BLOCKED_PERMISSIONS,
  );

  return config;
};

module.exports = createRunOncePlugin(
  withBackgroundAudio,
  "with-background-audio",
  "1.0.0",
);
module.exports.ANDROID_PLAYBACK_PERMISSIONS = ANDROID_PLAYBACK_PERMISSIONS;
module.exports.addAudioBackgroundMode = addAudioBackgroundMode;
