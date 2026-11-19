const mockStartRadio = jest.fn();
jest.mock("@/hooks/player/use-start-radio", () => ({
  useStartRadio: () => mockStartRadio,
}));
const mockReadAndPlay = jest.fn();
jest.mock("@/hooks/library/use-play-library-songs", () => ({
  ...jest.requireActual("@/hooks/library/use-play-library-songs"),
  usePlayLibrarySongs: () => ({ readAndPlay: mockReadAndPlay }),
}));
jest.mock("@/lib/api/library", () => ({
  getCanonicalLibraryPage: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useYourRadio } from "@/hooks/discover/use-your-radio";
import { getCanonicalLibraryPage } from "@/lib/api/library";

const mockGetPage = getCanonicalLibraryPage as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useYourRadio", () => {
  it("seeds a station from the Library songs played last", async () => {
    mockGetPage.mockResolvedValue({ tracks: [{ id: "12" }, { id: "40" }] });
    const { result } = await renderHook(() => useYourRadio());

    await act(() => result.current.start());

    expect(mockGetPage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tracks", sort: "played", pageSize: 5 }),
    );
    expect(mockStartRadio).toHaveBeenCalledWith({
      seed: { trackIds: ["12", "40"] },
      label: "Your",
    });
    expect(mockReadAndPlay).not.toHaveBeenCalled();
  });

  it("shuffles the Library before anything has been played", async () => {
    mockGetPage.mockResolvedValue({ tracks: [] });
    const { result } = await renderHook(() => useYourRadio());

    await act(() => result.current.start());

    expect(mockStartRadio).not.toHaveBeenCalled();
    expect(mockReadAndPlay).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ albumTitle: "Library" }),
      { shuffled: true },
    );
  });
});
