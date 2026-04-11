jest.mock('@/lib/api/search', () => ({
  addArtist: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addArtist } from '@/lib/api/search';
import { useAddArtist } from '@/hooks/search/use-add-artist';
import { libraryKeys } from '@/lib/query-keys';

const mockUseMutation = useMutation as jest.Mock;
const mockAddArtist = addArtist as jest.Mock;
const mockInvalidateQueries = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });
  mockUseMutation.mockImplementation((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  }));
});

describe('useAddArtist', () => {
  it('calls addArtist with correct params in mutationFn', async () => {
    const response = {
      queued: true,
      foreignArtistId: 'abc-123',
      artistName: 'Radiohead',
    };
    mockAddArtist.mockResolvedValue(response);

    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    const result = await config.mutationFn({
      foreignArtistId: 'abc-123',
      artistName: 'Radiohead',
      monitorOption: 'all',
    });
    expect(mockAddArtist).toHaveBeenCalledWith({
      foreignArtistId: 'abc-123',
      artistName: 'Radiohead',
      monitorOption: 'all',
    });
    expect(result).toEqual(response);
  });

  it('invalidates library artists on success', () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: libraryKeys.artists(),
    });
  });

  it('calls onSuccess callback when provided', () => {
    const onSuccess = jest.fn();
    useAddArtist(onSuccess);
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('does not throw when onSuccess callback is not provided', () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    expect(() => config.onSuccess()).not.toThrow();
  });
});
