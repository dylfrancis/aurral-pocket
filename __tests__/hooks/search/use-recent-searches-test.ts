jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecentSearches } from '@/hooks/search/use-recent-searches';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
});

describe('useRecentSearches', () => {
  it('starts with empty searches', () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it('loads saved searches from storage', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['radiohead', '#rock']));

    const { result } = renderHook(() => useRecentSearches());
    await act(async () => {});

    expect(result.current.searches).toEqual(['radiohead', '#rock']);
  });

  it('adds a search to the top', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => { await result.current.add('radiohead'); });
    expect(result.current.searches[0]).toBe('radiohead');
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('deduplicates and moves to top', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => { await result.current.add('first'); });
    await act(async () => { await result.current.add('second'); });
    await act(async () => { await result.current.add('first'); });

    expect(result.current.searches).toEqual(['first', 'second']);
  });

  it('ignores empty strings', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => { await result.current.add(''); });
    await act(async () => { await result.current.add('   '); });

    expect(result.current.searches).toEqual([]);
  });

  it('removes a specific search', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => { await result.current.add('keep'); });
    await act(async () => { await result.current.add('remove'); });
    await act(async () => { await result.current.remove('remove'); });

    expect(result.current.searches).toEqual(['keep']);
  });

  it('clears all searches', async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => { await result.current.add('one'); });
    await act(async () => { await result.current.add('two'); });
    await act(async () => { await result.current.clear(); });

    expect(result.current.searches).toEqual([]);
    expect(mockRemoveItem).toHaveBeenCalledWith('recent_searches');
  });

  it('limits to 10 entries', async () => {
    const { result } = renderHook(() => useRecentSearches());

    for (let i = 0; i < 15; i++) {
      await act(async () => { await result.current.add(`search-${i}`); });
    }

    expect(result.current.searches).toHaveLength(10);
    expect(result.current.searches[0]).toBe('search-14');
  });
});
