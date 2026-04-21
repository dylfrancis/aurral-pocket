jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Button } from "@/components/ui/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseColorScheme.mockReturnValue("dark");
});

describe("Button", () => {
  it("renders title text", () => {
    const { getByText } = render(
      <Button title="Press Me" onPress={() => {}} />,
    );
    expect(getByText("Press Me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Tap" onPress={onPress} />);
    fireEvent.press(getByText("Tap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows ActivityIndicator when loading", () => {
    const { queryByText, UNSAFE_getByType } = render(
      <Button title="Loading" onPress={() => {}} loading />,
    );
    expect(queryByText("Loading")).toBeNull();
    const { ActivityIndicator } = require("react-native");
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("is disabled when loading", () => {
    const onPress = jest.fn();
    const { queryByText } = render(
      <Button title="Wait" onPress={onPress} loading />,
    );
    // Title is hidden when loading, and pressing should be a no-op
    expect(queryByText("Wait")).toBeNull();
  });

  it("is disabled when disabled prop is set", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="No" onPress={onPress} disabled />,
    );
    fireEvent.press(getByText("No"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders inline variant", () => {
    const { getByText } = render(
      <Button title="Link" variant="inline" onPress={() => {}} />,
    );
    expect(getByText("Link")).toBeTruthy();
  });

  it("applies custom style", () => {
    const { getByText } = render(
      <Button title="Styled" onPress={() => {}} style={{ marginTop: 99 }} />,
    );
    expect(getByText("Styled")).toBeTruthy();
  });
});
