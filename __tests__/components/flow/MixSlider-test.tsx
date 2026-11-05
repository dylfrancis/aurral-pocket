jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MixSlider } from "@/components/flow/MixSlider";
import type { MixPercent } from "@/lib/types/flow";

const sum = (mix: MixPercent) =>
  mix.discover + mix.mix + mix.trending + mix.focus + mix.newReleases;

describe("MixSlider", () => {
  it("renders a slider for all five sources", async () => {
    const { getByTestId } = await render(
      <MixSlider
        value={{
          discover: 50,
          mix: 30,
          trending: 20,
          focus: 0,
          newReleases: 0,
        }}
        onChange={jest.fn()}
      />,
    );
    expect(getByTestId("mix-slider-discover")).toBeTruthy();
    expect(getByTestId("mix-slider-mix")).toBeTruthy();
    expect(getByTestId("mix-slider-trending")).toBeTruthy();
    expect(getByTestId("mix-slider-focus")).toBeTruthy();
    expect(getByTestId("mix-slider-newReleases")).toBeTruthy();
  });

  it("rebalances other sources to keep the total at 100 when focus changes", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixSlider
        value={{
          discover: 50,
          mix: 30,
          trending: 20,
          focus: 0,
          newReleases: 0,
        }}
        onChange={onChange}
      />,
    );
    await fireEvent(getByTestId("mix-slider-focus"), "valueChange", 40);
    const next: MixPercent = onChange.mock.calls[0][0];
    expect(next.focus).toBe(40);
    expect(sum(next)).toBe(100);
  });

  it("keeps the total at 100 when an existing source changes", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixSlider
        value={{
          discover: 30,
          mix: 20,
          trending: 10,
          focus: 40,
          newReleases: 0,
        }}
        onChange={onChange}
      />,
    );
    await fireEvent(getByTestId("mix-slider-discover"), "valueChange", 70);
    const next: MixPercent = onChange.mock.calls[0][0];
    expect(next.discover).toBe(70);
    expect(sum(next)).toBe(100);
  });

  // Trending and focus split the 49 left evenly, so both shares are 24.5.
  it("keeps the total at 100 when two shares round up together", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixSlider
        value={{
          discover: 50,
          mix: 0,
          trending: 25,
          focus: 25,
          newReleases: 0,
        }}
        onChange={onChange}
      />,
    );
    await fireEvent(getByTestId("mix-slider-discover"), "valueChange", 51);
    const next: MixPercent = onChange.mock.calls[0][0];
    expect(next.discover).toBe(51);
    expect(sum(next)).toBe(100);
  });
});
