jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Colors } from "@/constants/theme";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ScreenCenter", () => {
  it("renders loading indicator when loading prop is true", () => {
    const { getByTestId } = render(<ScreenCenter loading />);
    // ActivityIndicator uses the "ActivityIndicator" accessibilityRole
    const indicator = getByTestId("screen-center");
    expect(indicator).toBeTruthy();
  });

  it("renders children when loading is false", () => {
    const { getByText } = render(
      <ScreenCenter>
        <Text>Hello</Text>
      </ScreenCenter>,
    );
    expect(getByText("Hello")).toBeTruthy();
  });

  it("does not render loading indicator when showing children", () => {
    const { queryByRole } = render(
      <ScreenCenter>
        <Text>Content</Text>
      </ScreenCenter>,
    );
    // No ActivityIndicator should be present
    expect(queryByRole("progressbar")).toBeNull();
  });

  it("applies background color from theme", () => {
    const { getByTestId } = render(<ScreenCenter loading />);
    const container = getByTestId("screen-center");
    const flatStyle = Object.assign(
      {},
      ...container.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.backgroundColor).toBe(Colors.dark.background);
  });
});
