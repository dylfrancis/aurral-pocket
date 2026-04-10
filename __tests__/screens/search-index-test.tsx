jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/search/use-artist-search', () => ({
  useArtistSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
  })),
}));

jest.mock('@/hooks/search/use-library-lookup', () => ({
  useLibraryLookup: jest.fn(() => ({
    isInLibrary: jest.fn(() => false),
    libraryArtists: [],
  })),
}));

jest.mock('expo-router', () => ({
  useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: any) => <View testID="expo-image" {...props} /> };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(props: any, ref: any) {
    return React.createElement(View, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    interpolate: () => 0,
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import SearchScreen from '@/app/(app)/(tabs)/(search)/index';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';

const mockUseArtistSearch = useArtistSearch as jest.Mock;
const mockUseLibraryLookup = useLibraryLookup as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseArtistSearch.mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
  });
  mockUseLibraryLookup.mockReturnValue({
    isInLibrary: jest.fn(() => false),
    libraryArtists: [],
  });
});

describe('SearchScreen', () => {
  it('shows empty state by default', () => {
    const { getByText } = render(<SearchScreen />);
    expect(getByText('Search for artists to add to your library')).toBeTruthy();
  });

  it('shows "In Library" chip for library artists in results', () => {
    const isInLibrary = jest.fn((mbid: string) => mbid === 'mbid-1');
    mockUseLibraryLookup.mockReturnValue({ isInLibrary, libraryArtists: [] });
    mockUseArtistSearch.mockReturnValue({
      data: {
        artists: [
          { id: 'mbid-1', name: 'Artist A', 'sort-name': 'Artist A', image: null, imageUrl: null, listeners: null },
          { id: 'mbid-2', name: 'Artist B', 'sort-name': 'Artist B', image: null, imageUrl: null, listeners: null },
        ],
        count: 2,
        offset: 0,
      },
      isLoading: false,
      isFetching: false,
    });

    const { getByText, queryAllByText } = render(<SearchScreen />);
    expect(getByText('Artist A')).toBeTruthy();
    expect(getByText('Artist B')).toBeTruthy();
    expect(queryAllByText('In Library')).toHaveLength(1);
  });
});
