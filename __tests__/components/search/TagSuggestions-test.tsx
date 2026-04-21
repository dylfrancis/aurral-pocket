jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TagSuggestions } from "@/components/search/TagSuggestions";

describe("TagSuggestions", () => {
  it("renders tag chips", () => {
    const { getByText } = render(
      <TagSuggestions tags={["rock", "indie", "pop"]} onSelect={() => {}} />,
    );
    expect(getByText("rock")).toBeTruthy();
    expect(getByText("indie")).toBeTruthy();
    expect(getByText("pop")).toBeTruthy();
  });

  it("calls onSelect with tag name when pressed", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TagSuggestions tags={["rock", "pop"]} onSelect={onSelect} />,
    );
    fireEvent.press(getByText("rock"));
    expect(onSelect).toHaveBeenCalledWith("rock");
  });

  it("returns null when tags array is empty", () => {
    const { toJSON } = render(<TagSuggestions tags={[]} onSelect={() => {}} />);
    expect(toJSON()).toBeNull();
  });
});
