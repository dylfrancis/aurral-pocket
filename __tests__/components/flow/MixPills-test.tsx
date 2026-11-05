jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { MixPills } from "@/components/flow/MixPills";
import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

// WCAG 2.2 relative luminance and contrast ratio for "#rrggbb" colours.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("MixPills", () => {
  it("renders a pill per non-zero source", async () => {
    const { getByText } = await render(
      <MixPills
        mix={{
          discover: 30,
          mix: 20,
          trending: 10,
          focus: 30,
          newReleases: 10,
        }}
      />,
    );
    expect(getByText("Discover 30%")).toBeTruthy();
    expect(getByText("Mix 20%")).toBeTruthy();
    expect(getByText("Trend 10%")).toBeTruthy();
    expect(getByText("Focus 30%")).toBeTruthy();
    expect(getByText("New Releases 10%")).toBeTruthy();
  });

  it("hides pills for 0% sources", async () => {
    const { queryByText, getByText } = await render(
      <MixPills
        mix={{ discover: 50, mix: 50, trending: 0, focus: 0, newReleases: 0 }}
      />,
    );
    expect(getByText("Discover 50%")).toBeTruthy();
    expect(getByText("Mix 50%")).toBeTruthy();
    expect(queryByText("Trend 0%")).toBeNull();
    expect(queryByText("Focus 0%")).toBeNull();
    expect(queryByText("New Releases 0%")).toBeNull();
  });

  // The labels are 12px, so WCAG AA asks for 4.5:1 against the pill fill.
  it.each(["light", "dark"] as const)(
    "keeps every pill label at 4.5:1 on its fill in %s mode",
    async (scheme) => {
      mockUseColorScheme.mockReturnValue(scheme);
      const { getByText } = await render(
        <MixPills
          mix={{
            discover: 20,
            mix: 20,
            trending: 20,
            focus: 20,
            newReleases: 20,
          }}
        />,
      );
      for (const label of [
        "Discover 20%",
        "Mix 20%",
        "Trend 20%",
        "Focus 20%",
        "New Releases 20%",
      ]) {
        const text = getByText(label);
        let pill = text.parent;
        while (pill && !StyleSheet.flatten(pill.props.style)?.backgroundColor) {
          pill = pill.parent;
        }
        const fill = StyleSheet.flatten(pill?.props.style).backgroundColor;
        const labelColor = StyleSheet.flatten(text.props.style).color;
        expect({
          label,
          meetsAA: contrast(labelColor, fill) >= 4.5,
        }).toEqual({ label, meetsAA: true });
      }
    },
  );
});
