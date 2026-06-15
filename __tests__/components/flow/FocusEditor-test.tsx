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
  it("renders entry names, not array indices (regression #139)", async () => {
    const { getByText, queryByText } = await render(
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

  it("shows empty state when there are no entries", async () => {
    const { getByText } = await render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={[]}
        onChange={jest.fn()}
      />,
    );
    expect(getByText("No filters added.")).toBeTruthy();
  });

  it("appends a trimmed entry on submit", async () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = await render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient"]}
        onChange={onChange}
      />,
    );
    const input = getByPlaceholderText("Add a tag");
    await fireEvent.changeText(input, "  shoegaze  ");
    await fireEvent(input, "submitEditing");
    expect(onChange).toHaveBeenCalledWith(["ambient", "shoegaze"]);
  });

  it("does not add duplicate entries", async () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = await render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient"]}
        onChange={onChange}
      />,
    );
    const input = getByPlaceholderText("Add a tag");
    await fireEvent.changeText(input, "ambient");
    await fireEvent(input, "submitEditing");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes an entry via its chip remove button", async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(
      <FocusEditor
        label="Tags"
        placeholder="Add a tag"
        value={["ambient", "shoegaze"]}
        onChange={onChange}
      />,
    );
    await fireEvent.press(getByLabelText("Remove ambient"));
    expect(onChange).toHaveBeenCalledWith(["shoegaze"]);
  });
});
