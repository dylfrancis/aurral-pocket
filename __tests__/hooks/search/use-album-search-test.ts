jest.mock("@/lib/api/search", () => ({
  searchAlbums: jest.fn(),
}));

jest.mock("@/hooks/search/use-debounced-value", () => ({
  useDebouncedValue: jest.fn((v: string) => v),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  keepPreviousData: Symbol("keepPreviousData"),
}));

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { searchKeys } from "@/lib/query-keys";

const mockUseQuery = useQuery as jest.Mock;
const mockUseDebouncedValue = useDebouncedValue as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDebouncedValue.mockImplementation((v: string) => v);
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
});

describe("useAlbumSearch", () => {
  it("passes trimmed query to useDebouncedValue", () => {
    useAlbumSearch("  abbey road  ");
    expect(mockUseDebouncedValue).toHaveBeenCalledWith("abbey road");
  });

  it("uses correct query key", () => {
    useAlbumSearch("abbey road");
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(searchKeys.albums("abbey road"));
  });

  it("is disabled when query is shorter than 2 characters", () => {
    useAlbumSearch("a");
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it("is enabled when query is 2+ characters", () => {
    useAlbumSearch("ab");
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it("uses keepPreviousData as placeholderData", () => {
    useAlbumSearch("test");
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.placeholderData).toBe(keepPreviousData);
  });
});
