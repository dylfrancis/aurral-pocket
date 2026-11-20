const { addSiriKeys } = require("@/modules/siri/app.plugin");

describe("addSiriKeys", () => {
  // Expo Router hands its routes to other devices under its own type.
  it("keeps the activity types another plugin declared", () => {
    const plist = {
      NSUserActivityTypes: ["$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route"],
    };

    expect(addSiriKeys(plist).NSUserActivityTypes).toEqual([
      "$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route",
      "INPlayMediaIntent",
    ]);
  });

  it("adds nothing twice when the plugin runs again", () => {
    const once = addSiriKeys({});

    expect(addSiriKeys(once)).toEqual(once);
  });
});
