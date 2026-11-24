const {
  markFeaturesOptional,
} = require("@/plugins/with-optional-hardware-features");

function usesFeature(name: string, required: string) {
  return { $: { "android:name": name, "android:required": required } };
}

describe("markFeaturesOptional", () => {
  it("lets Play offer the app to devices without Wi-Fi or a portrait screen", () => {
    const manifest = {
      manifest: {
        "uses-feature": [usesFeature("android.hardware.camera", "false")],
      },
    };

    expect(markFeaturesOptional(manifest).manifest["uses-feature"]).toEqual([
      usesFeature("android.hardware.camera", "false"),
      usesFeature("android.hardware.wifi", "false"),
      usesFeature("android.hardware.screen.portrait", "false"),
    ]);
  });

  it("makes a declared feature optional without declaring it twice", () => {
    // Prebuild without --clean runs the plugin again on the manifest it wrote.
    const manifest = {
      manifest: {
        "uses-feature": [usesFeature("android.hardware.wifi", "true")],
      },
    };

    markFeaturesOptional(manifest);
    markFeaturesOptional(manifest);

    expect(manifest.manifest["uses-feature"]).toEqual([
      usesFeature("android.hardware.wifi", "false"),
      usesFeature("android.hardware.screen.portrait", "false"),
    ]);
  });
});
