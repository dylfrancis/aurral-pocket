let mockReducedMotion = false;
// Reanimated's shipped mock fails to load under jest-expo. Only the reduced
// motion setting matters here.
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => mockReducedMotion,
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MarqueeText } from "@/components/ui/MarqueeText";

const TITLE = "Everything In Its Right Place (Live in Paris, Extended)";

function layout(width: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height: 30 } } };
}

async function renderLaidOut(lineWidth: number, textWidth: number) {
  await render(<MarqueeText>{TITLE}</MarqueeText>);
  const [measured] = screen.getAllByText(TITLE, {
    includeHiddenElements: true,
  });
  await fireEvent(measured, "layout", layout(textWidth));
  await fireEvent(screen.getByText(TITLE).parent!, "layout", layout(lineWidth));
}

beforeEach(() => {
  mockReducedMotion = false;
});

describe("MarqueeText", () => {
  it("scrolls text wider than its line, and reads it once", async () => {
    await renderLaidOut(300, 520);

    // The loop's trailing copy is on screen, but not read twice.
    expect(
      screen.getAllByText(TITLE, { includeHiddenElements: true }),
    ).toHaveLength(3);
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it("stays still when the text fits", async () => {
    await renderLaidOut(300, 200);

    expect(
      screen.getAllByText(TITLE, { includeHiddenElements: true }),
    ).toHaveLength(2);
  });

  it("stays still and truncates with reduced motion", async () => {
    mockReducedMotion = true;
    await renderLaidOut(300, 520);

    expect(
      screen.getAllByText(TITLE, { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByText(TITLE).props.numberOfLines).toBe(1);
  });
});
