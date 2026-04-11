jest.mock('@/lib/api/search', () => ({
  searchArtists: jest.fn(),
}));

jest.mock('@/hooks/search/use-debounced-value', () => ({
  useDebouncedValue: jest.fn((v: string) => v),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  keepPreviousData: Symbol('keepPreviousData'),
}));

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/search/use-debounced-value';
import { useArtistSearch } from '@/hooks/search/use-artist-search';
import { searchKeys } from '@/lib/query-keys';

const mockUseQuery = useQuery as jest.Mock;
const mockUseDebouncedValue = useDebouncedValue as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDebouncedValue.mockImplementation((v: string) => v);
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
});

describe('useArtistSearch', () => {
  it('passes trimmed query to useDebouncedValue', () => {
    useArtistSearch('  radiohead  ');
    expect(mockUseDebouncedValue).toHaveBeenCalledWith('radiohead');
  });

  it('uses correct query key', () => {
    useArtistSearch('radiohead');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(searchKeys.artists('radiohead'));
  });

  it('is disabled when query is shorter than 2 characters', () => {
    useArtistSearch('r');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('is enabled when query is 2+ characters', () => {
    useArtistSearch('ra');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when debounced query is empty', () => {
    mockUseDebouncedValue.mockReturnValue('');
    useArtistSearch('');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('uses keepPreviousData as placeholderData', () => {
    useArtistSearch('test');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.placeholderData).toBe(keepPreviousData);
  });

  it('sets staleTime to 5 minutes', () => {
    useArtistSearch('test');
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(5 * 60 * 1000);
  });
});
