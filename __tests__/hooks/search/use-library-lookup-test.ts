jest.mock('@/hooks/library/use-library-artists', () => ({
  useLibraryArtists: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useLibraryArtists } from '@/hooks/library/use-library-artists';
import { useLibraryLookup } from '@/hooks/search/use-library-lookup';

const mockUseLibraryArtists = useLibraryArtists as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useLibraryLookup', () => {
  it('returns isInLibrary that matches known mbids', () => {
    mockUseLibraryArtists.mockReturnValue({
      data: [
        { id: '1', mbid: 'mbid-aaa', artistName: 'Artist A' },
        { id: '2', mbid: 'mbid-bbb', artistName: 'Artist B' },
      ],
    });

    const { result } = renderHook(() => useLibraryLookup());

    expect(result.current.isInLibrary('mbid-aaa')).toBe(true);
    expect(result.current.isInLibrary('mbid-bbb')).toBe(true);
  });

  it('returns false for unknown mbids', () => {
    mockUseLibraryArtists.mockReturnValue({
      data: [{ id: '1', mbid: 'mbid-aaa', artistName: 'Artist A' }],
    });

    const { result } = renderHook(() => useLibraryLookup());

    expect(result.current.isInLibrary('mbid-zzz')).toBe(false);
  });

  it('handles undefined artists data', () => {
    mockUseLibraryArtists.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useLibraryLookup());

    expect(result.current.isInLibrary('mbid-aaa')).toBe(false);
  });

  it('exposes the raw library artists', () => {
    const artists = [{ id: '1', mbid: 'mbid-aaa', artistName: 'Artist A' }];
    mockUseLibraryArtists.mockReturnValue({ data: artists });

    const { result } = renderHook(() => useLibraryLookup());

    expect(result.current.libraryArtists).toBe(artists);
  });
});
