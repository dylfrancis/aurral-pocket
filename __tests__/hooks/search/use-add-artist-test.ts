jest.mock("@/lib/api/search", () => ({
  addArtist: jest.fn(),
}));

const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  })),
  useQueryClient: jest.fn(() => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  })),
}));

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addArtist } from "@/lib/api/search";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { discoverKeys, libraryKeys } from "@/lib/query-keys";

const mockUseMutation = useMutation as jest.Mock;
const mockAddArtist = addArtist as jest.Mock;

const mockArtist = {
  id: "1",
  mbid: "abc-123",
  foreignArtistId: "abc-123",
  artistName: "Radiohead",
  monitored: true,
  monitorOption: "all",
  addedAt: "2024-01-01",
  statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  (useQueryClient as jest.Mock).mockReturnValue({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  });
  mockUseMutation.mockImplementation((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  }));
});

describe("useAddArtist", () => {
  it("calls addArtist with correct params", async () => {
    const response = {
      queued: false,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      artist: mockArtist,
    };
    mockAddArtist.mockResolvedValue(response);

    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    const result = await config.mutationFn({
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitorOption: "all",
    });
    expect(mockAddArtist).toHaveBeenCalled();
    expect(result).toEqual(response);
  });

  it("updates cache when artist returned in response", () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: false,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      artist: mockArtist,
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(
      libraryKeys.artists(),
      expect.any(Function),
    );
    expect(mockSetQueryData).toHaveBeenCalledWith(
      libraryKeys.artist("abc-123"),
      mockArtist,
    );
  });

  it("creates placeholder artist in cache when queued", () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: true,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(
      libraryKeys.artists(),
      expect.any(Function),
    );
    expect(mockSetQueryData).toHaveBeenCalledWith(
      libraryKeys.artist("abc-123"),
      expect.objectContaining({ mbid: "abc-123", artistName: "Radiohead" }),
    );
  });

  it("prepends to recently-added cache and marks it stale on a queued add", () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: true,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    });

    const recentCall = mockSetQueryData.mock.calls.find(
      ([key]) =>
        JSON.stringify(key) === JSON.stringify(discoverKeys.recentlyAdded()),
    );
    expect(recentCall).toBeDefined();

    const updater = recentCall![1] as (
      old: { foreignArtistId: string }[] | undefined,
    ) => { foreignArtistId: string }[];
    const existing = [{ foreignArtistId: "existing-1" }];
    expect(updater(existing)).toEqual([
      expect.objectContaining({
        id: "abc-123",
        mbid: "abc-123",
        foreignArtistId: "abc-123",
        artistName: "Radiohead",
      }),
      { foreignArtistId: "existing-1" },
    ]);
    // Seeds an empty/undefined cache.
    expect(updater(undefined)).toHaveLength(1);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: discoverKeys.recentlyAdded(),
      refetchType: "none",
    });
  });

  it("does not duplicate when the artist is already in recently-added", () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: true,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    });

    const recentCall = mockSetQueryData.mock.calls.find(
      ([key]) =>
        JSON.stringify(key) === JSON.stringify(discoverKeys.recentlyAdded()),
    );
    const updater = recentCall![1] as (
      old: { foreignArtistId: string }[] | undefined,
    ) => { foreignArtistId: string }[];
    const existing = [{ foreignArtistId: "abc-123" }];
    expect(updater(existing)).toBe(existing);
  });

  it("leaves recently-added untouched for an existing (200) artist", () => {
    useAddArtist();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: false,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      artist: mockArtist,
    });

    const recentCall = mockSetQueryData.mock.calls.find(
      ([key]) =>
        JSON.stringify(key) === JSON.stringify(discoverKeys.recentlyAdded()),
    );
    expect(recentCall).toBeUndefined();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("calls onSuccess callback when provided", () => {
    const onSuccess = jest.fn();
    useAddArtist(onSuccess);
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      queued: false,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
