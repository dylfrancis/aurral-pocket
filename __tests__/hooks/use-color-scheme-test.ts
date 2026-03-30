import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  actual.useColorScheme = jest.fn();
  return actual;
});

import { useColorScheme } from '@/hooks/use-color-scheme';

const mockRNColorScheme = useRNColorScheme as jest.Mock;

describe('useColorScheme', () => {
  it('returns "dark" when system is dark', () => {
    mockRNColorScheme.mockReturnValue('dark');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');
  });

  it('returns "light" when system is light', () => {
    mockRNColorScheme.mockReturnValue('light');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('returns "light" when system returns null', () => {
    mockRNColorScheme.mockReturnValue(null);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('returns "light" when system returns undefined', () => {
    mockRNColorScheme.mockReturnValue(undefined);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });
});
