import { render, fireEvent } from "@testing-library/react-native";
import { TagPill } from "@/components/ui/TagPill";

describe("TagPill", () => {
  it("renders the tag name with a leading #", async () => {
    const { getByText } = await render(<TagPill name="rock" />);
    expect(getByText("#rock")).toBeTruthy();
  });

  it("renders as non-pressable when onPress is not provided", async () => {
    const { queryByRole } = await render(<TagPill name="jazz" />);
    expect(queryByRole("button")).toBeNull();
  });

  it("renders as pressable and fires onPress with the tag name", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <TagPill name="indie" onPress={onPress} />,
    );
    await fireEvent.press(getByText("#indie"));
    expect(onPress).toHaveBeenCalledWith("indie");
  });
});
