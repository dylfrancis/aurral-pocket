jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render } from "@testing-library/react-native";
import { MixPills } from "@/components/flow/MixPills";

describe("MixPills", () => {
  it("renders a pill per non-zero channel", async () => {
    const { getByText } = await render(
      <MixPills mix={{ discover: 30, mix: 20, trending: 10, focus: 40 }} />,
    );
    expect(getByText("Discover 30%")).toBeTruthy();
    expect(getByText("Mix 20%")).toBeTruthy();
    expect(getByText("Trend 10%")).toBeTruthy();
    expect(getByText("Focus 40%")).toBeTruthy();
  });

  it("hides pills for 0% channels", async () => {
    const { queryByText, getByText } = await render(
      <MixPills mix={{ discover: 50, mix: 50, trending: 0, focus: 0 }} />,
    );
    expect(getByText("Discover 50%")).toBeTruthy();
    expect(getByText("Mix 50%")).toBeTruthy();
    expect(queryByText("Trend 0%")).toBeNull();
    expect(queryByText("Focus 0%")).toBeNull();
  });
});
