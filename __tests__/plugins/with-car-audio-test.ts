const {
  addAndroidAutoEntries,
  addCarPlayScene,
} = require("@/plugins/with-car-audio");

const PHONE_SCENE = {
  UISceneConfigurationName: "Default Configuration",
  UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
};

describe("addCarPlayScene", () => {
  it("runs CarPlay through the engine's scene delegate beside the phone's scene", () => {
    const plist = addCarPlayScene({
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [PHONE_SCENE],
        },
      },
    });

    expect(plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [PHONE_SCENE],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneClassName: "CPTemplateApplicationScene",
            UISceneConfigurationName: "CarPlay",
            UISceneDelegateClassName: "NitroPlayerCarPlaySceneDelegate",
          },
        ],
      },
    });
  });

  it("adds the scene once when the plugin runs again", () => {
    const once = addCarPlayScene({});

    expect(addCarPlayScene(once)).toEqual(once);
  });
});

describe("addAndroidAutoEntries", () => {
  const manifest = () => ({
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      application: [{ $: {}, service: [{ $: { "android:name": ".Other" } }] }],
    },
  });

  it("lets Android Auto browse the engine and list the app as a media app", () => {
    const { application } = addAndroidAutoEntries(manifest()).manifest;

    expect(application[0]["meta-data"]).toEqual([
      {
        $: {
          "android:name": "com.google.android.gms.car.application",
          "android:resource": "@xml/automotive_app_desc",
        },
      },
    ]);
    expect(application[0].service).toEqual([
      { $: { "android:name": ".Other" } },
      {
        $: {
          "android:name":
            "com.margelo.nitro.nitroplayer.media.NitroPlayerMediaBrowserService",
          "android:exported": "true",
          "android:foregroundServiceType": "mediaPlayback",
          "tools:ignore": "ExportedService",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.media.browse.MediaBrowserService",
                },
              },
            ],
          },
        ],
      },
    ]);
  });

  it("declares the tools namespace the service's lint opt-out uses", () => {
    expect(addAndroidAutoEntries(manifest()).manifest.$["xmlns:tools"]).toBe(
      "http://schemas.android.com/tools",
    );
  });

  it("adds each entry once when the plugin runs again", () => {
    const once = addAndroidAutoEntries(manifest());
    const { application } = addAndroidAutoEntries(once).manifest;

    expect(application[0]["meta-data"]).toHaveLength(1);
    expect(application[0].service).toHaveLength(2);
  });
});
