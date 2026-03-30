jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseColorScheme.mockReturnValue('dark');
});

describe('Text', () => {
  it('renders children', () => {
    const { getByText } = render(<Text>Hello</Text>);
    expect(getByText('Hello')).toBeTruthy();
  });

  it('defaults to body variant', () => {
    const { getByText } = render(<Text>Body text</Text>);
    const el = getByText('Body text');
    const flatStyle = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean))
      : el.props.style;
    expect(flatStyle.fontFamily).toBe(Fonts.regular);
    expect(flatStyle.color).toBe(Colors.dark.text);
  });

  it('applies title variant styles', () => {
    const { getByText } = render(<Text variant="title">Title</Text>);
    const el = getByText('Title');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.fontFamily).toBe(Fonts.bold);
    expect(flatStyle.fontSize).toBe(28);
    expect(flatStyle.color).toBe(Colors.dark.text);
  });

  it('applies subtitle variant with subtle color', () => {
    const { getByText } = render(<Text variant="subtitle">Sub</Text>);
    const el = getByText('Sub');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.color).toBe(Colors.dark.subtle);
  });

  it('applies error variant with error color', () => {
    const { getByText } = render(<Text variant="error">Oops</Text>);
    const el = getByText('Oops');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.color).toBe(Colors.dark.error);
  });

  it('applies caption variant with subtle color', () => {
    const { getByText } = render(<Text variant="caption">Note</Text>);
    const el = getByText('Note');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.color).toBe(Colors.dark.subtle);
    expect(flatStyle.fontSize).toBe(13);
  });

  it('respects light color scheme', () => {
    mockUseColorScheme.mockReturnValue('light');
    const { getByText } = render(<Text variant="title">Light</Text>);
    const el = getByText('Light');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.color).toBe(Colors.light.text);
  });

  it('allows style overrides', () => {
    const { getByText } = render(<Text style={{ color: 'red' }}>Custom</Text>);
    const el = getByText('Custom');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.color).toBe('red');
  });

  it('passes through additional TextProps', () => {
    const { getByText } = render(<Text numberOfLines={1}>Truncated</Text>);
    expect(getByText('Truncated').props.numberOfLines).toBe(1);
  });
});
