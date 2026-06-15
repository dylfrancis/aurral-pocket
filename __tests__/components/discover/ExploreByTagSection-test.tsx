jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/ui/Skeleton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Skeleton: () => React.createElement(View, { testID: "skeleton" }),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { ExploreByTagSection } from "@/components/discover/ExploreByTagSection";
import { useDiscovery } from "@/hooks/discover";

const mockHook = useDiscovery as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ExploreByTagSection", () => {
  it("shows skeleton while loading", async () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });

    const { queryAllByTestId, queryByText } = await render(
      <ExploreByTagSection onTagPress={jest.fn()} />,
    );

    expect(queryByText("Explore By Tag")).toBeTruthy();
    expect(queryAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("returns null when topTags is empty", async () => {
    mockHook.mockReturnValue({
      data: {
        recommendations: [],
        globalTop: [],
        basedOn: [],
        topTags: [],
        topGenres: [],
        lastUpdated: null,
        isUpdating: false,
        configured: true,
      },
      isLoading: false,
    });

    const { toJSON } = await render(
      <ExploreByTagSection onTagPress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders tag pills and fires onTagPress with the tag name", async () => {
    mockHook.mockReturnValue({
      data: {
        recommendations: [],
        globalTop: [],
        basedOn: [],
        topTags: ["rock", "jazz"],
        topGenres: [],
        lastUpdated: null,
        isUpdating: false,
        configured: true,
      },
      isLoading: false,
    });
    const onPress = jest.fn();

    const { getByText } = await render(
      <ExploreByTagSection onTagPress={onPress} />,
    );

    await fireEvent.press(getByText("#rock"));
    expect(onPress).toHaveBeenCalledWith("rock");
  });
});
