const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Declares the app to CarPlay and Android Auto; the audio engine draws both.
 * The CarPlay audio entitlement needs CARPLAY_AUDIO_ENTITLEMENT=1: until Apple
 * grants it to the App ID, a device build signed with it fails.
 */

const CARPLAY_ROLE = "CPTemplateApplicationSceneSessionRoleApplication";
const CARPLAY_SCENE = {
  UISceneClassName: "CPTemplateApplicationScene",
  UISceneConfigurationName: "CarPlay",
  UISceneDelegateClassName: "NitroPlayerCarPlaySceneDelegate",
};
const CARPLAY_AUDIO_ENTITLEMENT = "com.apple.developer.carplay-audio";

const BROWSER_SERVICE =
  "com.margelo.nitro.nitroplayer.media.NitroPlayerMediaBrowserService";
const CAR_APP_META_DATA = "com.google.android.gms.car.application";
const AUTOMOTIVE_APP_DESC = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media" />
</automotiveApp>
`;

/** Add the CarPlay scene, keeping the phone's scene as it is. */
function addCarPlayScene(infoPlist) {
  const manifest = infoPlist.UIApplicationSceneManifest ?? {};
  const configurations = manifest.UISceneConfigurations ?? {};
  return {
    ...infoPlist,
    UIApplicationSceneManifest: {
      ...manifest,
      UISceneConfigurations: {
        ...configurations,
        [CARPLAY_ROLE]: [CARPLAY_SCENE],
      },
    },
  };
}

/** Add the media browser service and the car meta-data, once each. */
function addAndroidAutoEntries(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest.$["xmlns:tools"] ??= "http://schemas.android.com/tools";
  const application = manifest.application[0];

  const metaData = (application["meta-data"] ??= []);
  if (
    !metaData.some((entry) => entry.$["android:name"] === CAR_APP_META_DATA)
  ) {
    metaData.push({
      $: {
        "android:name": CAR_APP_META_DATA,
        "android:resource": "@xml/automotive_app_desc",
      },
    });
  }

  const services = (application.service ??= []);
  if (!services.some((entry) => entry.$["android:name"] === BROWSER_SERVICE)) {
    services.push({
      $: {
        "android:name": BROWSER_SERVICE,
        "android:exported": "true",
        "android:foregroundServiceType": "mediaPlayback",
        "tools:ignore": "ExportedService",
      },
      "intent-filter": [
        {
          action: [
            {
              $: { "android:name": "android.media.browse.MediaBrowserService" },
            },
          ],
        },
      ],
    });
  }
  return androidManifest;
}

const withCarAudio = (config) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = addCarPlayScene(cfg.modResults);
    return cfg;
  });

  if (process.env.CARPLAY_AUDIO_ENTITLEMENT === "1") {
    config = withEntitlementsPlist(config, (cfg) => {
      cfg.modResults[CARPLAY_AUDIO_ENTITLEMENT] = true;
      return cfg;
    });
  }

  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addAndroidAutoEntries(cfg.modResults);
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(
        path.join(dir, "automotive_app_desc.xml"),
        AUTOMOTIVE_APP_DESC,
      );
      return cfg;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(withCarAudio, "with-car-audio", "1.0.0");
module.exports.addCarPlayScene = addCarPlayScene;
module.exports.addAndroidAutoEntries = addAndroidAutoEntries;
