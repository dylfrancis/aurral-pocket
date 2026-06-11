jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { FocusEditor } from "@/components/flow/FocusEditor";

describe("FocusEditor", () => {
  it("renders entry names, not array indices (regression #139)", () => {
    const { getByText, queryByText } = render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient", "shoegaze", "post-rock"]}
        onChange={jest.fn()}
      />,
    );
    expect(getByText("ambient")).toBeTruthy();
    expect(getByText("shoegaze")).toBeTruthy();
    expect(getByText("post-rock")).toBeTruthy();
    expect(queryByText("0")).toBeNull();
    expect(queryByText("1")).toBeNull();
    expect(queryByText("2")).toBeNull();
  });

  it("shows empty state when there are no entries", () => {
    const { getByText } = render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={[]}
        onChange={jest.fn()}
      />,
    );
    expect(getByText("No filters added.")).toBeTruthy();
  });

  it("appends a trimmed entry on submit", () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient"]}
        onChange={onChange}
      />,
    );
    const input = getByPlaceholderText("Add a tag");
    fireEvent.changeText(input, "  shoegaze  ");
    fireEvent(input, "submitEditing");
    expect(onChange).toHaveBeenCalledWith(["ambient", "shoegaze"]);
  });

  it("does not add duplicate entries", () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient"]}
        onChange={onChange}
      />,
    );
    const input = getByPlaceholderText("Add a tag");
    fireEvent.changeText(input, "ambient");
    fireEvent(input, "submitEditing");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes an entry via its chip remove button", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient", "shoegaze"]}
        onChange={onChange}
      />,
    );
    fireEvent.press(getByLabelText("Remove ambient"));
    expect(onChange).toHaveBeenCalledWith(["shoegaze"]);
  });
});
