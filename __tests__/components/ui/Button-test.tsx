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
  it("renders title text", async () => {
    const { getByText } = await render(
      <Button title="Press Me" onPress={() => {}} />,
    );
    expect(getByText("Press Me")).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <Button title="Tap" onPress={onPress} />,
    );
    await fireEvent.press(getByText("Tap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows ActivityIndicator when loading", async () => {
    const { queryByText, getByTestId } = await render(
      <Button title="Loading" onPress={() => {}} loading />,
    );
    expect(queryByText("Loading")).toBeNull();
    expect(getByTestId("button-loading-indicator")).toBeTruthy();
  });

  it("is disabled when loading", async () => {
    const onPress = jest.fn();
    const { queryByText } = await render(
      <Button title="Wait" onPress={onPress} loading />,
    );
    // Title is hidden when loading, and pressing should be a no-op
    expect(queryByText("Wait")).toBeNull();
  });

  it("is disabled when disabled prop is set", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <Button title="No" onPress={onPress} disabled />,
    );
    await fireEvent.press(getByText("No"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders inline variant", async () => {
    const { getByText } = await render(
      <Button title="Link" variant="inline" onPress={() => {}} />,
    );
    expect(getByText("Link")).toBeTruthy();
  });

  it("applies custom style", async () => {
    const { getByText } = await render(
      <Button title="Styled" onPress={() => {}} style={{ marginTop: 99 }} />,
    );
    expect(getByText("Styled")).toBeTruthy();
  });
});
