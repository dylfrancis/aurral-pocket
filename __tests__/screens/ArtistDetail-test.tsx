jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(props: any, ref: any) {
    return React.createElement(View, { ...props, ref });
  });
  const MockAnimatedScrollView = React.forwardRef(function MockAnimatedScrollView(props: any, ref: any) {
    return React.createElement(ScrollView, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView, ScrollView: MockAnimatedScrollView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedScrollHandler: () => () => {},
    interpolate: () => 0,
  };
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/library/use-cover-art-url', () => ({
  useCoverArtUrl: jest.fn(() => ({ url: 'https://example.com/art.jpg', isLoading: false })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ mbid: 'abc-123' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: function MockLinearGradient(props: any) { return React.createElement(View, props); },
  };
});

jest.mock('@/components/library/AlbumSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AlbumSheet: function MockAlbumSheet() { return React.createElement(View, { testID: 'album-sheet' }); },
  };
});

jest.mock('@/components/library/ArtistActionSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ArtistActionSheet: function MockArtistActionSheet() { return React.createElement(View, { testID: 'artist-action-sheet' }); },
  };
});

jest.mock('@/hooks/library/use-library-artist', () => ({
  useLibraryArtist: jest.fn(),
}));

jest.mock('@/hooks/library/use-library-albums', () => ({
  useLibraryAlbums: jest.fn(),
}));

jest.mock('@/hooks/library/use-albums-with-types', () => ({
  useAlbumsWithTypes: jest.fn((_mbid: string, albums: any[]) => ({
    albums: albums?.map((a: any) => ({ ...a, albumType: 'Album', secondaryTypes: [] })),
    isLoadingTypes: false,
  })),
}));

jest.mock('@/hooks/library/use-release-type-filter', () => {
  const PRIMARY_TYPES = ['Album', 'EP', 'Single'];
  const SECONDARY_TYPES = ['Live', 'Remix', 'Compilation', 'Demo', 'Broadcast', 'Soundtrack', 'Spokenword', 'Other'];
  const ALL = [...PRIMARY_TYPES, ...SECONDARY_TYPES];
  return {
    useReleaseTypeFilter: jest.fn(() => ({
      selected: new Set(ALL),
      toggleSecondary: jest.fn(),
      selectAll: jest.fn(),
      clearSecondary: jest.fn(),
      activeSecondaryCount: 0,
    })),
    matchesFilter: jest.fn(() => true),
    PRIMARY_TYPES,
    SECONDARY_TYPES,
  };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ArtistDetailScreen from '@/app/(app)/(tabs)/(library)/artist/[mbid]';
import { useLibraryArtist } from '@/hooks/library/use-library-artist';
import { useLibraryAlbums } from '@/hooks/library/use-library-albums';
import type { Artist, Album } from '@/lib/types/library';

const mockUseLibraryArtist = useLibraryArtist as jest.Mock;
const mockUseLibraryAlbums = useLibraryAlbums as jest.Mock;

const baseArtist: Artist = {
  id: '1',
  mbid: 'abc-123',
  foreignArtistId: 'abc-123',
  artistName: 'Test Artist',
  monitored: true,
  monitorOption: 'all',
  addedAt: '2024-01-01',
  statistics: { albumCount: 2, trackCount: 20, sizeOnDisk: 1000 },
};

const makeAlbum = (overrides: Partial<Album> & { id: string }): Album => ({
  artistId: '1',
  artistName: 'Test Artist',
  mbid: `mbid-${overrides.id}`,
  foreignAlbumId: `fid-${overrides.id}`,
  albumName: `Album ${overrides.id}`,
  title: `Album ${overrides.id}`,
  releaseDate: '2024-01-01',
  monitored: false,
  statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
  ...overrides,
});

const defaultAlbumHook = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({}),
  isRefetching: false,
};

const defaultArtistHook = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({}),
  isRefetching: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook });
  mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook });
});

describe('ArtistDetailScreen', () => {
  describe('loading state', () => {
    it('shows loading indicator while artist is loading', () => {
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, isLoading: true });
      const { getByTestId, UNSAFE_getByType } = render(<ArtistDetailScreen />);
      expect(getByTestId('screen-center')).toBeTruthy();
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('shows error message when artist fails to load', () => {
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, error: new Error('fail') });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('Failed to load artist')).toBeTruthy();
    });

    it('shows retry button on artist error', () => {
      const refetch = jest.fn();
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, error: new Error('fail'), refetch });
      const { getByText } = render(<ArtistDetailScreen />);
      fireEvent.press(getByText('Try Again'));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('not found state', () => {
    it('shows not found when artist is null', () => {
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, data: null });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('Artist not found')).toBeTruthy();
    });
  });

  describe('with artist loaded', () => {
    beforeEach(() => {
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, data: baseArtist });
    });

    it('renders artist name', () => {
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('Test Artist')).toBeTruthy();
    });

    it('shows albums section header', () => {
      mockUseLibraryArtist.mockReturnValue({ ...defaultArtistHook, data: baseArtist });
      const albums = [makeAlbum({ id: '1' })];
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: albums });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('Albums')).toBeTruthy();
    });

    it('shows empty state when no albums', () => {
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: [] });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('No albums in library')).toBeTruthy();
    });

    it('shows album count in header when albums exist', () => {
      const albums = [makeAlbum({ id: '1' }), makeAlbum({ id: '2' })];
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: albums });
      const { getByText } = render(<ArtistDetailScreen />);
      // Albums are now in collapsible sections — count shown as separate text
      expect(getByText('Albums')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });

    it('renders album rows', () => {
      const albums = [makeAlbum({ id: '1', albumName: 'First Album' })];
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: albums });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('First Album')).toBeTruthy();
    });

    it('sorts albums by release date descending', () => {
      const albums = [
        makeAlbum({ id: '1', albumName: 'Older', releaseDate: '2020-01-01' }),
        makeAlbum({ id: '2', albumName: 'Newer', releaseDate: '2024-06-01' }),
      ];
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: albums });
      const { getAllByText } = render(<ArtistDetailScreen />);
      const albumTexts = getAllByText(/Older|Newer/);
      expect(albumTexts[0].props.children).toBe('Newer');
      expect(albumTexts[1].props.children).toBe('Older');
    });

    it('puts albums without release date last', () => {
      const albums = [
        makeAlbum({ id: '1', albumName: 'No Date', releaseDate: undefined as any }),
        makeAlbum({ id: '2', albumName: 'Has Date', releaseDate: '2024-01-01' }),
      ];
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, data: albums });
      const { getAllByText } = render(<ArtistDetailScreen />);
      const albumTexts = getAllByText(/No Date|Has Date/);
      expect(albumTexts[0].props.children).toBe('Has Date');
      expect(albumTexts[1].props.children).toBe('No Date');
    });

    it('shows album error with retry', () => {
      const refetch = jest.fn();
      mockUseLibraryAlbums.mockReturnValue({ ...defaultAlbumHook, error: new Error('fail'), refetch });
      const { getByText } = render(<ArtistDetailScreen />);
      expect(getByText('Failed to load albums')).toBeTruthy();
      fireEvent.press(getByText('Try Again'));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
});
