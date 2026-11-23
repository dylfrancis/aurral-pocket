jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return { ...actual, useMemo: (fn: () => unknown) => fn() };
});

jest.mock("@/lib/api/library", () => ({
  researchAurralAlbum: jest.fn(),
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
import { researchAurralAlbum } from "@/lib/api/library";
import {
  getEligibleMissingAlbums,
  useResearchMissingAlbums,
} from "@/hooks/library/use-research-missing-albums";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

const mockUseMutation = useMutation as jest.Mock;
const mockResearchAurralAlbum = researchAurralAlbum as jest.Mock;

const artist = { mbid: "artist-mb", name: "Artist" };

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: "900",
    canonicalId: "900",
    managed: true,
    artistId: "art1",
    artistName: "Artist",
    mbid: "mb1",
    albumName: "Album",
    title: "Album",
    releaseDate: "2020-01-01",
    monitored: true,
    statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 0 },
    ...overrides,
  };
}

// Aurral answers a status for every album it manages; without one an album
// isn't offered, so each case below that expects to drop an album has one.
const partialStatuses: DownloadStatusMap = { "900": { status: "partial" } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getEligibleMissingAlbums", () => {
  it("returns [] when albums is undefined", () => {
    expect(getEligibleMissingAlbums(undefined, undefined)).toEqual([]);
  });

  it("excludes complete albums (percentOfTracks >= 100)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 0, percentOfTracks: 100 },
    });
    expect(getEligibleMissingAlbums([album], partialStatuses)).toEqual([]);
  });

  it("excludes complete albums (sizeOnDisk > 0)", () => {
    const album = makeAlbum({
      statistics: { trackCount: 10, sizeOnDisk: 500, percentOfTracks: 0 },
    });
    expect(getEligibleMissingAlbums([album], partialStatuses)).toEqual([]);
  });

  it("excludes albums Aurral doesn't manage", () => {
    const album = makeAlbum({ managed: false });
    expect(getEligibleMissingAlbums([album], partialStatuses)).toEqual([]);
  });

  it.each([
    ["partial", true, true],
    ["queued", true, false],
    ["downloading", true, false],
    ["unreleased", true, false],
    // Aurral doesn't count an unmonitored album's tracks toward failed.
    ["failed", false, false],
  ])(
    "reads an album's %p status by its Library id (monitored %p)",
    (status, monitored, eligible) => {
      const album = makeAlbum({ monitored });
      const statuses = { "900": { status: status as "partial" } };
      expect(getEligibleMissingAlbums([album], statuses)).toEqual(
        eligible ? [album] : [],
      );
    },
  );
});

describe("useResearchMissingAlbums", () => {
  it("reports the count of eligible missing albums", () => {
    const albums = [
      makeAlbum(),
      makeAlbum({
        id: "901",
        canonicalId: "901",
        statistics: { trackCount: 10, sizeOnDisk: 1, percentOfTracks: 100 },
      }),
    ];
    const result = useResearchMissingAlbums(
      albums,
      { ...partialStatuses, "901": { status: "partial" } },
      artist,
    );
    expect(result.missingCount).toBe(1);
  });

  it("re-searches each eligible album by its Library id", async () => {
    mockResearchAurralAlbum.mockResolvedValue(null);
    const album = makeAlbum({ artistName: "" });

    useResearchMissingAlbums([album], partialStatuses, artist);
    const { config } = mockUseMutation.mock.results[0].value;
    await config.mutationFn();

    expect(mockResearchAurralAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalId: "900", monitored: true }),
      { mbid: "artist-mb", name: "Artist" },
    );
  });

  it("optimistically marks eligible albums as queued, under each one's Library id", () => {
    const albums = [
      makeAlbum(),
      makeAlbum({ id: "901", canonicalId: "901" }),
      makeAlbum({ id: "902", canonicalId: "902" }),
    ];
    useResearchMissingAlbums(
      albums,
      {
        ...partialStatuses,
        "901": { status: "cancelled" },
        "902": { status: "downloading" },
      },
      artist,
    );
    const { config } = mockUseMutation.mock.results[0].value;

    config.onMutate();
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ["library", "downloadStatuses"] },
      expect.any(Function),
    );
    const updater = mockSetQueriesData.mock.calls[0][1];
    expect(updater({})).toEqual({
      "900": { status: "queued" },
      "901": { status: "queued" },
    });
  });
});
