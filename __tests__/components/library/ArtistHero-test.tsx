jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(props: any, ref: any) {
    return React.createElement(View, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView, ScrollView: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedScrollHandler: () => () => {},
    interpolate: (val: number, input: number[], output: number[]) => {
      const [inMin, inMax] = input;
      const [outMin, outMax] = output;
      const clamped = Math.min(Math.max(val, inMin), inMax);
      const ratio = (clamped - inMin) / (inMax - inMin);
      return outMin + ratio * (outMax - outMin);
    },
  };
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/library/use-cover-art-url', () => ({
  useCoverArtUrl: jest.fn(() => ({ url: 'https://example.com/art.jpg', isLoading: false })),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: function MockLinearGradient(props: any) { return React.createElement(View, { ...props, testID: 'linear-gradient' }); },
  };
});

import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';
import { ArtistHero } from '@/components/library/ArtistHero';
import type { Artist } from '@/lib/types/library';

const baseArtist: Artist = {
  id: '1',
  mbid: 'abc-123',
  foreignArtistId: 'abc-123',
  artistName: 'Test Artist',
  monitored: true,
  monitorOption: 'all',
  addedAt: '2024-01-01',
  statistics: { albumCount: 5, trackCount: 50, sizeOnDisk: 1000 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ArtistHero', () => {
  it('renders artist name', () => {
    const { getByText } = render(<ArtistHero artist={baseArtist} />);
    expect(getByText('Test Artist')).toBeTruthy();
  });

  it('renders monitored badge', () => {
    const { getByText } = render(<ArtistHero artist={baseArtist} />);
    expect(getByText('Monitored')).toBeTruthy();
  });

  it('renders unmonitored badge when not monitored', () => {
    const artist = { ...baseArtist, monitored: false };
    const { getByText } = render(<ArtistHero artist={artist} />);
    expect(getByText('Unmonitored')).toBeTruthy();
  });

});
