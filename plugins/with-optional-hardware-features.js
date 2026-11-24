const {
  withAndroidManifest,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Hardware Google Play would otherwise treat as required, which hides the app
 * from devices without it.
 *
 * Play infers a required feature from some permissions and orientations unless
 * the manifest declares that feature itself:
 *
 * - android.hardware.wifi, from ACCESS_WIFI_STATE and
 *   CHANGE_WIFI_MULTICAST_STATE. The audio engine asks for both to find Cast
 *   devices, and expo-network asks for the first. Pocket streams over any
 *   network.
 * - android.hardware.screen.portrait, from the portrait lock in app.json. A
 *   landscape-only screen shows the app in a portrait window.
 *
 * The permissions and the portrait lock stay as they are.
 */

const OPTIONAL_FEATURES = [
  "android.hardware.wifi",
  "android.hardware.screen.portrait",
];

/** Declare each feature with required="false", once. */
function markFeaturesOptional(androidManifest) {
  const features = androidManifest.manifest["uses-feature"] || [];
  for (const name of OPTIONAL_FEATURES) {
    const declared = features.find((f) => f.$["android:name"] === name);
    if (declared) {
      declared.$["android:required"] = "false";
    } else {
      features.push({
        $: { "android:name": name, "android:required": "false" },
      });
    }
  }
  androidManifest.manifest["uses-feature"] = features;
  return androidManifest;
}

const withOptionalHardwareFeatures = (config) =>
  withAndroidManifest(config, (cfg) => {
    markFeaturesOptional(cfg.modResults);
    return cfg;
  });

module.exports = createRunOncePlugin(
  withOptionalHardwareFeatures,
  "with-optional-hardware-features",
  "1.0.0",
);
module.exports.markFeaturesOptional = markFeaturesOptional;
