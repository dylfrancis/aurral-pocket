jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/search/use-artist-search', () => ({
  useArtistSearch: jest.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}));

jest.mock('@/hooks/search/use-tag-suggestions', () => ({
  useTagSuggestions: jest.fn(() => ({ data: undefined })),
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
import { useTagSuggestions } from '@/hooks/search/use-tag-suggestions';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';

const mockUseArtistSearch = useArtistSearch as jest.Mock;
const mockUseTagSuggestions = useTagSuggestions as jest.Mock;
const mockUseLibraryLookup = useLibraryLookup as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseArtistSearch.mockReturnValue({
    data: undefined,
    isLoading: false,
  });
  mockUseTagSuggestions.mockReturnValue({ data: undefined });
  mockUseLibraryLookup.mockReturnValue({
    isInLibrary: jest.fn(() => false),
    libraryArtists: [],
  });
});

describe('SearchScreen', () => {
  it('shows empty state by default', () => {
    const { getByText } = render(<SearchScreen />);
    expect(getByText('Search for artists or #tags to discover music')).toBeTruthy();
  });
});
