jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MixSlider } from "@/components/flow/MixSlider";
import type { MixPercent } from "@/lib/types/flow";

const sum = (mix: MixPercent) =>
  mix.discover + mix.mix + mix.trending + mix.focus;

describe("MixSlider", () => {
  it("renders a slider for all four channels", async () => {
    const { getByTestId } = await render(
      <MixSlider
        value={{ discover: 50, mix: 30, trending: 20, focus: 0 }}
        onChange={jest.fn()}
      />,
    );
    expect(getByTestId("mix-slider-discover")).toBeTruthy();
    expect(getByTestId("mix-slider-mix")).toBeTruthy();
    expect(getByTestId("mix-slider-trending")).toBeTruthy();
    expect(getByTestId("mix-slider-focus")).toBeTruthy();
  });

  it("rebalances other channels to keep the total at 100 when focus changes", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixSlider
        value={{ discover: 50, mix: 30, trending: 20, focus: 0 }}
        onChange={onChange}
      />,
    );
    await fireEvent(getByTestId("mix-slider-focus"), "valueChange", 40);
    const next: MixPercent = onChange.mock.calls[0][0];
    expect(next.focus).toBe(40);
    expect(sum(next)).toBe(100);
  });

  it("keeps the total at 100 when an existing channel changes", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixSlider
        value={{ discover: 30, mix: 20, trending: 10, focus: 40 }}
        onChange={onChange}
      />,
    );
    await fireEvent(getByTestId("mix-slider-discover"), "valueChange", 70);
    const next: MixPercent = onChange.mock.calls[0][0];
    expect(next.discover).toBe(70);
    expect(sum(next)).toBe(100);
  });
});
