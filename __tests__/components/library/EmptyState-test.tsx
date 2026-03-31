jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '@/components/library/EmptyState';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EmptyState', () => {
  it('renders message text', () => {
    const { getByText } = render(<EmptyState message="Your library is empty" />);
    expect(getByText('Your library is empty')).toBeTruthy();
  });

  it('does not render button when no action provided', () => {
    const { queryByText } = render(<EmptyState message="Empty" />);
    expect(queryByText('Try Again')).toBeNull();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState message="Error" actionLabel="Try Again" onAction={onAction} />,
    );
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('calls onAction when button is pressed', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState message="Error" actionLabel="Retry" onAction={onAction} />,
    );
    fireEvent.press(getByText('Retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
