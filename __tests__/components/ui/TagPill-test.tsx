import { render, fireEvent } from "@testing-library/react-native";
import { TagPill } from "@/components/ui/TagPill";

describe("TagPill", () => {
  it("renders the tag name with a leading #", () => {
    const { getByText } = render(<TagPill name="rock" />);
    expect(getByText("#rock")).toBeTruthy();
  });

  it("renders as non-pressable when onPress is not provided", () => {
    const { UNSAFE_queryAllByType } = render(<TagPill name="jazz" />);
    const { Pressable } = require("react-native");
    expect(UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
  });

  it("renders as pressable and fires onPress with the tag name", () => {
    const onPress = jest.fn();
    const { getByText } = render(<TagPill name="indie" onPress={onPress} />);
    fireEvent.press(getByText("#indie"));
    expect(onPress).toHaveBeenCalledWith("indie");
  });
});
