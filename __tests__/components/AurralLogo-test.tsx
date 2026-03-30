jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    SvgXml: (props: any) => React.createElement('SvgXml', props),
  };
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { AurralLogo } from '@/components/AurralLogo';
import { useColorScheme } from '@/hooks/use-color-scheme';

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  mockUseColorScheme.mockReturnValue('light');
});

describe('AurralLogo', () => {
  it('renders with default size', () => {
    const { root } = render(<AurralLogo />);
    const svg = root.findByProps({ height: 56 });
    expect(svg).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { root } = render(<AurralLogo size={32} />);
    const svg = root.findByProps({ height: 32 });
    expect(svg).toBeTruthy();
  });

  it('uses dark color in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');
    const { root } = render(<AurralLogo />);
    const svg = root.findByProps({ height: 56 });
    expect(svg.props.xml).toContain('fill="#707e61"');
    expect(svg.props.xml).not.toContain('fill="currentColor"');
  });

  it('uses light color in light mode', () => {
    mockUseColorScheme.mockReturnValue('light');
    const { root } = render(<AurralLogo />);
    const svg = root.findByProps({ height: 56 });
    expect(svg.props.xml).toContain('fill="#4a5840"');
    expect(svg.props.xml).not.toContain('fill="currentColor"');
  });

  it('uses custom color when provided', () => {
    const { root } = render(<AurralLogo color="#ff0000" />);
    const svg = root.findByProps({ height: 56 });
    expect(svg.props.xml).toContain('fill="#ff0000"');
    expect(svg.props.xml).not.toContain('fill="currentColor"');
  });

  it('maintains correct aspect ratio', () => {
    const { root } = render(<AurralLogo size={100} />);
    const svg = root.findByProps({ height: 100 });
    // 650/485 ≈ 1.3402
    expect(svg.props.width).toBeCloseTo(100 * (650 / 485), 1);
  });
});
