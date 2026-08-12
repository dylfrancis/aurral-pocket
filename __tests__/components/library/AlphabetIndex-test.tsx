jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

import React from "react";
import { render, fireEvent, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { AlphabetIndex } from "@/components/library/AlphabetIndex";
import type { LetterIndexEntry } from "@/lib/alphabet-index";

const ENTRIES: LetterIndexEntry[] = [
  { letter: "#", index: 0 },
  { letter: "A", index: 2 },
  { letter: "B", index: 7 },
  { letter: "C", index: 11 },
];

const STRIP_HEIGHT = 280; // 4 letters, 70 per row

async function layoutStrip(strip: any) {
  await fireEvent(strip, "layout", {
    nativeEvent: { layout: { height: STRIP_HEIGHT } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AlphabetIndex", () => {
  it("renders every letter", async () => {
    const { getByText } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={jest.fn()} />,
    );
    for (const { letter } of ENTRIES) {
      expect(getByText(letter)).toBeTruthy();
    }
  });

  it("selects the letter under the touch", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={onSelect} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 10 },
    });
    expect(onSelect).toHaveBeenCalledWith(ENTRIES[0]);

    await fireEvent(strip, "responderMove", {
      nativeEvent: { locationY: 150 },
    });
    expect(onSelect).toHaveBeenCalledWith(ENTRIES[2]);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("does not reselect while the touch stays on the same letter", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={onSelect} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 80 },
    });
    await fireEvent(strip, "responderMove", {
      nativeEvent: { locationY: 100 },
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("reselects a letter after the touch is released", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={onSelect} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 80 },
    });
    await fireEvent(strip, "responderRelease", {});
    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 80 },
    });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("clamps touches outside the strip to the nearest letter", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={onSelect} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 9999 },
    });
    expect(onSelect).toHaveBeenCalledWith(ENTRIES[3]);
  });

  it("fires a selection haptic when the letter changes", async () => {
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={jest.fn()} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 10 },
    });
    await fireEvent(strip, "responderMove", {
      nativeEvent: { locationY: 150 },
    });
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("shows a bubble with the held letter and hides it on release", async () => {
    const { getByTestId, queryByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={jest.fn()} />,
    );
    const strip = getByTestId("alphabet-index");
    await layoutStrip(strip);

    expect(queryByTestId("alphabet-index-bubble")).toBeNull();

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 10 },
    });
    const bubble = getByTestId("alphabet-index-bubble");
    expect(within(bubble).getByText("#")).toBeTruthy();

    await fireEvent(strip, "responderMove", {
      nativeEvent: { locationY: 150 },
    });
    expect(
      within(getByTestId("alphabet-index-bubble")).getByText("B"),
    ).toBeTruthy();

    await fireEvent(strip, "responderRelease", {});
    expect(queryByTestId("alphabet-index-bubble")).toBeNull();
  });

  it("ignores touches before layout", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <AlphabetIndex entries={ENTRIES} onSelect={onSelect} />,
    );
    const strip = getByTestId("alphabet-index");

    await fireEvent(strip, "responderGrant", {
      nativeEvent: { locationY: 10 },
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
