const {
  withAppDelegate,
  withEntitlementsPlist,
  withInfoPlist,
  createRunOncePlugin,
} = require("expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const pkg = require("./package.json");

const PLAY_MEDIA_INTENT = "INPlayMediaIntent";

/**
 * Lets Siri send "play … with Aurral" to the app itself:
 *  - the Siri entitlement (EAS turns the capability on for the App ID);
 *  - the Info.plist keys in addSiriKeys;
 *  - the app delegate's `application(_:handlerFor:)`, which Expo doesn't pass
 *    on to modules.
 */
const withSiri = (config) => {
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults["com.apple.developer.siri"] = true;
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = addSiriKeys(cfg.modResults);
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("The Siri plugin expects a Swift AppDelegate.");
    }
    cfg.modResults.contents = addIntentHandler(cfg.modResults.contents);
    return cfg;
  });

  return config;
};

/**
 * - INIntentsSupported, so Siri sends the app the play intent;
 * - INSupportedMediaCategories, without which Siri answers that the app
 *   "hasn't added support for that";
 * - NSUserActivityTypes, without which donating a played item fails.
 */
function addSiriKeys(infoPlist) {
  return {
    ...infoPlist,
    INIntentsSupported: addOnce(
      infoPlist.INIntentsSupported,
      PLAY_MEDIA_INTENT,
    ),
    INSupportedMediaCategories: addOnce(
      infoPlist.INSupportedMediaCategories,
      "INMediaCategoryMusic",
    ),
    NSUserActivityTypes: addOnce(
      infoPlist.NSUserActivityTypes,
      PLAY_MEDIA_INTENT,
    ),
  };
}

const HANDLER_SOURCE = `
  // Siri asks the app, not an extension, to play what was asked for.
  public func application(_ application: UIApplication, handlerFor intent: INIntent) -> Any? {
    return PlayMediaIntentHandler.handler(for: intent) { [weak self] in
      self?.startReactNativeWithoutWindow()
    }
  }

  // When Siri wakes the app, no window opens, and React Native starts only
  // with one. Start it without one so JS can answer. The window that opens
  // later reuses it.
  private func startReactNativeWithoutWindow() {
    guard let factory = reactNativeFactory,
      factory.rootViewFactory.value(forKey: "reactHost") == nil else { return }
    factory.rootViewFactory.initializeReactHost(
      launchOptions: nil,
      bundleConfiguration: factory.bundleConfiguration,
      devMenuConfiguration: factory.devMenuConfiguration ?? RCTDevMenuConfiguration.default()
    )
  }`;

function addIntentHandler(appDelegate) {
  const withImports = mergeContents({
    src: appDelegate,
    // Expo's module provider imports it as internal, and Swift wants one level.
    newSrc: ["internal import AurralSiri", "import Intents"].join("\n"),
    tag: "aurral-siri-imports",
    anchor: /^import React$/,
    offset: 1,
    comment: "//",
  }).contents;
  return mergeContents({
    src: withImports,
    newSrc: HANDLER_SOURCE,
    tag: "aurral-siri-handler",
    anchor:
      /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
    // Past the closing brace of didFinishLaunchingWithOptions.
    offset: 2,
    comment: "//",
  }).contents;
}

function addOnce(list, value) {
  const items = Array.isArray(list) ? list : [];
  return items.includes(value) ? items : [...items, value];
}

module.exports = createRunOncePlugin(withSiri, pkg.name, pkg.version);
module.exports.addSiriKeys = addSiriKeys;
module.exports.addIntentHandler = addIntentHandler;
