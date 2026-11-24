// jest-setup stands the slider in for every other suite; this one drives the
// real wrapper, with the SwiftUI or Compose slider under it recording its props.
jest.unmock("@/components/ui/NativeSlider");

jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));

const mockNativeSlider = jest.fn((_props: any) => null);
jest.mock("@expo/ui/swift-ui", () => ({
  Slider: (props: any) => mockNativeSlider(props),
}));
jest.mock("@expo/ui/jetpack-compose", () => ({
  Slider: (props: any) => mockNativeSlider(props),
}));

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { NativeSlider } from "@/components/ui/NativeSlider";
import type { NativeSliderProps } from "@/components/ui/native-slider";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";

const native = () => mockNativeSlider.mock.lastCall![0];

// SwiftUI reports a drag's start and end through onEditingChanged. Compose
// reports only its end, through onValueChangeFinished.
const drag = {
  start: () => {
    if (IS_IOS) native().onEditingChanged(true);
  },
  move: (value: number) => native().onValueChange(value),
  end: () => {
    if (IS_ANDROID) native().onValueChangeFinished();
    else native().onEditingChanged(false);
  },
};

async function renderSlider({
  value: initialValue = 0,
  ...props
}: Partial<NativeSliderProps> = {}) {
  const callbacks = {
    onValueChange: jest.fn(),
    onSlidingStart: jest.fn(),
    onSlidingComplete: jest.fn(),
  };
  const slider = (value: number) => (
    <NativeSlider
      value={value}
      min={0}
      max={240}
      color="#1db954"
      trackColor="#212121"
      thumbColor="#ffffff"
      accessibilityLabel="Seek within the track"
      {...callbacks}
      {...props}
    />
  );
  await render(slider(initialValue));
  return {
    ...callbacks,
    /** The parent's new value, as progress ticks or a finished seek bring. */
    setValue: (value: number) => screen.rerender(slider(value)),
  };
}

beforeEach(() => {
  mockNativeSlider.mockClear();
});

describe("NativeSlider", () => {
  it("reports a drag's start, each move, and the value it settled on", async () => {
    const slider = await renderSlider();

    drag.start();
    drag.move(30);
    drag.move(120);
    drag.end();

    expect(slider.onSlidingStart).toHaveBeenCalledTimes(1);
    expect(slider.onValueChange.mock.calls).toEqual([[30], [120]]);
    expect(slider.onSlidingComplete).toHaveBeenCalledTimes(1);
    expect(slider.onSlidingComplete).toHaveBeenCalledWith(120);
  });

  (IS_IOS ? it : it.skip)(
    "finishes a change made outside a drag at once on iOS",
    async () => {
      const slider = await renderSlider();

      drag.move(90);

      expect(slider.onSlidingComplete).toHaveBeenCalledWith(90);
    },
  );

  (IS_IOS ? it : it.skip)(
    "ends a press that moved nothing where the thumb rests on iOS",
    async () => {
      const slider = await renderSlider();
      drag.start();
      drag.move(60);
      drag.end();
      slider.onSlidingComplete.mockClear();
      await slider.setValue(180);

      drag.start();
      drag.end();

      expect(slider.onSlidingComplete).toHaveBeenCalledWith(180);
    },
  );

  (IS_ANDROID ? it : it.skip)(
    "reports nothing for a finish with no change before it on Android",
    async () => {
      const slider = await renderSlider({ value: 180 });

      drag.end();

      expect(slider.onSlidingStart).not.toHaveBeenCalled();
      expect(slider.onSlidingComplete).not.toHaveBeenCalled();
    },
  );
});
