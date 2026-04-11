import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '@/hooks/search/use-debounced-value';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello'));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe('a');
  });

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => jest.advanceTimersByTime(350));
    expect(result.current).toBe('ab');
  });

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => jest.advanceTimersByTime(200));

    rerender({ value: 'abc' });
    act(() => jest.advanceTimersByTime(200));

    // Only 200ms since last change — should still be 'a'
    expect(result.current).toBe('a');

    act(() => jest.advanceTimersByTime(150));
    // Now 350ms since 'abc' was set
    expect(result.current).toBe('abc');
  });

  it('uses custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 100),
      { initialProps: { value: 'x' } },
    );

    rerender({ value: 'xy' });
    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe('xy');
  });
});
