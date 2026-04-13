jest.mock("@/lib/api/search", () => ({
  addArtist: jest.fn(),
}));

const mockSetQueryData = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  })),
  useQueryClient: jest.fn(() => ({
    setQueryData: mockSetQueryData,
  })),
}));

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addArtist } from "@/lib/api/search";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { libraryKeys } from "@/lib/query-keys";

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
