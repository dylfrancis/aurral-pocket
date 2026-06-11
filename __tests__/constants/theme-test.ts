import { Colors, Fonts } from "@/constants/theme";

describe("Colors", () => {
  it("has both light and dark themes", () => {
    expect(Colors.light).toBeDefined();
    expect(Colors.dark).toBeDefined();
  });

  it("light and dark themes have the same keys", () => {
    const lightKeys = Object.keys(Colors.light).sort();
    const darkKeys = Object.keys(Colors.dark).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it("uses the brand color consistently", () => {
    expect(Colors.light.brand).toBe("#65a30d");
    expect(Colors.dark.brand).toBe("#84cc16");
    expect(Colors.light.tint).toBe(Colors.light.brand);
    expect(Colors.dark.tint).toBe(Colors.dark.brand);
    expect(Colors.light.buttonPrimary).toBe(Colors.light.brand);
    expect(Colors.dark.buttonPrimary).toBe(Colors.dark.brand);
  });

  it("dark theme has darker backgrounds than light theme", () => {
    // Dark background is pure black, light is off-white
    expect(Colors.dark.background).toBe("#000000");
    expect(Colors.light.background).toBe("#fafafa");
  });
});

describe("Fonts", () => {
  it("exports DM Sans font family variants", () => {
    expect(Fonts.regular).toBe("DMSans_400Regular");
    expect(Fonts.medium).toBe("DMSans_500Medium");
    expect(Fonts.semiBold).toBe("DMSans_600SemiBold");
    expect(Fonts.bold).toBe("DMSans_700Bold");
  });
});
