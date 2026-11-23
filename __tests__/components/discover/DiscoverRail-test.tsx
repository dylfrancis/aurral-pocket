jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { DiscoverRail } from "@/components/discover/DiscoverRail";

describe("DiscoverRail", () => {
  it("shows the first 12 cards, then a View All card", async () => {
    const onViewAll = jest.fn();
    const items = Array.from({ length: 15 }, (_, i) => `Card ${i}`);

    await render(
      <DiscoverRail
        title="Trending Artists"
        items={items}
        keyOf={(item) => item}
        renderItem={(item) => <Text>{item}</Text>}
        cardSize={140}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByText("Card 11")).toBeTruthy();
    expect(screen.queryByText("Card 12")).toBeNull();

    await fireEvent.press(screen.getByText("View All"));

    expect(onViewAll).toHaveBeenCalled();
  });
});
