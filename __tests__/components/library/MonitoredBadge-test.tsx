jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { MonitoredBadge } from '@/components/library/MonitoredBadge';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MonitoredBadge', () => {
  it('shows "Monitored" when monitored is true', () => {
    const { getByText } = render(<MonitoredBadge monitored />);
    expect(getByText('Monitored')).toBeTruthy();
  });

  it('shows "Unmonitored" when monitored is false', () => {
    const { getByText } = render(<MonitoredBadge monitored={false} />);
    expect(getByText('Unmonitored')).toBeTruthy();
  });
});
