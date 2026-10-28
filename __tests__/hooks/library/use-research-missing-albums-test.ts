jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return { ...actual, useMemo: (fn: () => unknown) => fn() };
});

jest.mock("@/lib/api/library", () => ({
  triggerAlbumSearch: jest.fn(),
  updateLibraryAlbum: jest.fn(),
}));

jest.mock("burnt", () => ({ toast: jest.fn() }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockSetQueriesData = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn((config: any) => ({
    config,
    mutate: config.mutationFn,
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    setQueriesData: mockSetQueriesData,
    invalidateQueries: mockInvalidateQueries,
  })),
}));

import { useMutation } from "@tanstack/react-query";
import { triggerAlbumSearch, updateLibraryAlbum } from "@/lib/api/library";
import {
  getEligibleMissingAlbums,
  useResearchMissingAlbums,
} from "@/hooks/library/use-research-missing-albums";
import type { Album } from "@/lib/types/library";

const mockUseMutation = useMutation as jest.Mock;
const mockTriggerAlbumSearch = triggerAlbumSearch as jest.Mock;
const mockUpdateLibraryAlbum = updateLibraryAlbum as jest.Mock;

// Canonical ids are numeric and Lidarr ids here are "a"-prefixed, so a
// Lidarr call that received a canonical id shows up in the assertion.
function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: "900",
    canonicalId: "900",
    lidarrId: "a1",
    artistId: "art1",
    artistName: "Artist",
    mbid: "mb1",
    foreignAlbumId: "f1",
    albumName: "Album",
    title: "Album",
    releaseDate: "2020-01-01",
    monitored: true,
    statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getEligibleMissingAlbums", () => {
  it("returns [] when albums is undefined", () => {
    expect(getEligibleMissingAlbums(undefined, undefined)).toEqual([]);
  });

  it("includes monitored incomplete albums", () => {
    const album = makeAlbum({ monitored: true });
    expect(getEligibleMissingAlbums([album], {})).toEqual([album]);
  });

  it("excludes complete albums (percentOfTracks >= 100)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 100 },
    });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes complete albums (sizeOnDisk > 0)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 500, percentOfTracks: 0 },
    });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes albums Lidarr does not manage", () => {
    const album = makeAlbum({ lidarrId: undefined });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });

  it("excludes albums already downloading", () => {
    const album = makeAlbum();
    expect(
      getEligibleMissingAlbums([album], { a1: { status: "downloading" } }),
    ).toEqual([]);
  });

  it("includes failed albums even if unmonitored", () => {
    const album = makeAlbum({ monitored: false });
    expect(
      getEligibleMissingAlbums([album], { a1: { status: "failed" } }),
    ).toEqual([album]);
  });

  it("excludes unmonitored albums with no failed status", () => {
    const album = makeAlbum({ monitored: false });
    expect(getEligibleMissingAlbums([album], {})).toEqual([]);
  });
});

describe("useResearchMissingAlbums", () => {
  it("reports the count of eligible missing albums", () => {
    const albums = [
      makeAlbum({ monitored: true }),
      makeAlbum({
        id: "901",
        lidarrId: "a2",
        statistics: { trackCount: 10, sizeOnDisk: 1, percentOfTracks: 100 },
      }),
    ];
    const result = useResearchMissingAlbums(albums, {});
    expect(result.missingCount).toBe(1);
  });

  it("force-monitors unmonitored albums then searches all eligible, by Lidarr id", async () => {
    mockUpdateLibraryAlbum.mockResolvedValue({});
    mockTriggerAlbumSearch.mockResolvedValue({});
    const albums = [
      makeAlbum({ monitored: true }),
      makeAlbum({
        id: "901",
        lidarrId: "a2",
        monitored: false,
        statistics: { trackCount: 1, sizeOnDisk: 0, percentOfTracks: 0 },
      }),
    ];

    useResearchMissingAlbums(albums, { a2: { status: "failed" } });
    const { config } = mockUseMutation.mock.results[0].value;
    const count = await config.mutationFn();

    expect(mockUpdateLibraryAlbum).toHaveBeenCalledTimes(1);
    expect(mockUpdateLibraryAlbum).toHaveBeenCalledWith("a2", {
      monitored: true,
    });
    expect(mockTriggerAlbumSearch.mock.calls).toEqual([["a1"], ["a2"]]);
    expect(count).toBe(2);
  });

  it("optimistically marks eligible albums as searching", () => {
    const albums = [makeAlbum({ monitored: true })];
    useResearchMissingAlbums(albums, {});
    const { config } = mockUseMutation.mock.results[0].value;

    config.onMutate();
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ["library", "downloadStatuses"] },
      expect.any(Function),
    );
    const updater = mockSetQueriesData.mock.calls[0][1];
    expect(updater({})).toEqual({ a1: { status: "searching" } });
  });
});
