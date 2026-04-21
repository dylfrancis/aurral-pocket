jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { render } from "@testing-library/react-native";
import { Chip } from "@/components/ui/Chip";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseColorScheme.mockReturnValue("dark");
});

describe("Chip", () => {
  it("renders label text", () => {
    const { getByText } = render(<Chip label="Complete" />);
    expect(getByText("Complete")).toBeTruthy();
  });

  it("renders with brand variant colors", () => {
    const { getByText } = render(<Chip label="Monitored" variant="brand" />);
    const label = getByText("Monitored");
    const flatStyle = Object.assign(
      {},
      ...label.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.color).toBe(Colors.dark.brandStrong);
  });

  it("renders with subtle variant colors", () => {
    const { getByText } = render(<Chip label="Unmonitored" variant="subtle" />);
    const label = getByText("Unmonitored");
    const flatStyle = Object.assign(
      {},
      ...label.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.color).toBe(Colors.dark.subtle);
  });

  it("renders with error variant colors", () => {
    const { getByText } = render(<Chip label="Failed" variant="error" />);
    const label = getByText("Failed");
    const flatStyle = Object.assign(
      {},
      ...label.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.color).toBe(Colors.dark.error);
  });

  it("defaults to subtle variant", () => {
    const { getByText } = render(<Chip label="Default" />);
    const label = getByText("Default");
    const flatStyle = Object.assign(
      {},
      ...label.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.color).toBe(Colors.dark.subtle);
  });

  it("renders without icon when not provided", () => {
    const { queryByTestId } = render(<Chip label="No Icon" />);
    // No crash, renders fine without icon
    expect(queryByTestId("chip-icon")).toBeNull();
  });

  it("adapts to light color scheme", () => {
    mockUseColorScheme.mockReturnValue("light");
    const { getByText } = render(<Chip label="Light" variant="brand" />);
    const label = getByText("Light");
    const flatStyle = Object.assign(
      {},
      ...label.props.style.flat(Infinity).filter(Boolean),
    );
    expect(flatStyle.color).toBe(Colors.light.brandStrong);
  });
});
