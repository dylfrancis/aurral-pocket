jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '@/components/ui/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

const mockUseColorScheme = useColorScheme as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseColorScheme.mockReturnValue('dark');
});

describe('Input', () => {
  it('renders with placeholder', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Email" />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
  });

  it('applies theme colors', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Test" />);
    const el = getByPlaceholderText('Test');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.backgroundColor).toBe(Colors.dark.inputBackground);
    expect(flatStyle.borderColor).toBe(Colors.dark.inputBorder);
    expect(flatStyle.color).toBe(Colors.dark.inputText);
    expect(flatStyle.fontFamily).toBe(Fonts.regular);
  });

  it('applies light theme colors', () => {
    mockUseColorScheme.mockReturnValue('light');
    const { getByPlaceholderText } = render(<Input placeholder="Test" />);
    const el = getByPlaceholderText('Test');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.backgroundColor).toBe(Colors.light.inputBackground);
    expect(flatStyle.borderColor).toBe(Colors.light.inputBorder);
  });

  it('fires onChangeText', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Type" onChangeText={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText('Type'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('defaults autoCapitalize to none', () => {
    const { getByPlaceholderText } = render(<Input placeholder="X" />);
    expect(getByPlaceholderText('X').props.autoCapitalize).toBe('none');
  });

  it('defaults autoCorrect to false', () => {
    const { getByPlaceholderText } = render(<Input placeholder="X" />);
    expect(getByPlaceholderText('X').props.autoCorrect).toBe(false);
  });

  it('allows overriding autoCapitalize', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Name" autoCapitalize="words" />,
    );
    expect(getByPlaceholderText('Name').props.autoCapitalize).toBe('words');
  });

  it('respects editable prop', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Locked" editable={false} />,
    );
    expect(getByPlaceholderText('Locked').props.editable).toBe(false);
  });

  it('allows style overrides', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Custom" style={{ marginBottom: 20 }} />,
    );
    const el = getByPlaceholderText('Custom');
    const flatStyle = Object.assign({}, ...el.props.style.flat(Infinity).filter(Boolean));
    expect(flatStyle.marginBottom).toBe(20);
  });

  it('exports inputBaseStyle and inputThemedStyle for composition', () => {
    const { inputBaseStyle, inputThemedStyle } = require('@/components/ui/Input');
    expect(inputBaseStyle).toBeDefined();
    expect(inputBaseStyle.borderRadius).toBe(12);
    const themed = inputThemedStyle('dark');
    expect(themed.backgroundColor).toBe(Colors.dark.inputBackground);
    expect(themed.fontFamily).toBe(Fonts.regular);
  });
});
