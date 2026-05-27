const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require("expo/config-plugins");

const pkg = require("./package.json");

const DEFAULT_MIC_PERMISSION =
  "Allow Aurral to use the microphone to identify the song playing around you.";

/**
 * Keeps the Shazam feature's native config co-located with the module:
 *  - iOS: microphone usage string.
 *  - Android: RECORD_AUDIO + INTERNET permissions.
 *
 * Note: the ShazamKit *capability* on the iOS App ID is enabled in the Apple
 * Developer portal (managed by EAS credentials), not via this plugin — there is
 * no Info.plist/entitlement key to toggle for catalog access.
 */
const withShazam = (config, { microphonePermission } = {}) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSMicrophoneUsageDescription =
      microphonePermission ||
      cfg.modResults.NSMicrophoneUsageDescription ||
      DEFAULT_MIC_PERMISSION;
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      "android.permission.RECORD_AUDIO",
      "android.permission.INTERNET",
    ]);
    return cfg;
  });

  return config;
};

module.exports = createRunOncePlugin(withShazam, pkg.name, pkg.version);
