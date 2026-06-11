jest.mock("react-native-svg", () => {
  const React = require("react");
  return {
    SvgXml: (props: any) => React.createElement("SvgXml", props),
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

import React from "react";
import { render } from "@testing-library/react-native";
import { AurralLogo } from "@/components/AurralLogo";
import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  mockUseColorScheme.mockReturnValue("light");
});

describe("AurralLogo", () => {
  it("renders with default size", async () => {
    const { root } = await render(<AurralLogo />);
    expect(root!.props.height).toBe(56);
  });

  it("renders with custom size", async () => {
    const { root } = await render(<AurralLogo size={32} />);
    expect(root!.props.height).toBe(32);
  });

  it("uses dark color in dark mode", async () => {
    mockUseColorScheme.mockReturnValue("dark");
    const { root } = await render(<AurralLogo />);
    expect(root!.props.xml).toContain('fill="#84cc16"');
    expect(root!.props.xml).not.toContain('fill="currentColor"');
  });

  it("uses light color in light mode", async () => {
    mockUseColorScheme.mockReturnValue("light");
    const { root } = await render(<AurralLogo />);
    expect(root!.props.xml).toContain('fill="#65a30d"');
    expect(root!.props.xml).not.toContain('fill="currentColor"');
  });

  it("uses custom color when provided", async () => {
    const { root } = await render(<AurralLogo color="#ff0000" />);
    expect(root!.props.xml).toContain('fill="#ff0000"');
    expect(root!.props.xml).not.toContain('fill="currentColor"');
  });

  it("maintains correct aspect ratio", async () => {
    const { root } = await render(<AurralLogo size={100} />);
    // 650/485 ≈ 1.3402
    expect(root!.props.width).toBeCloseTo(100 * (650 / 485), 1);
  });
});
