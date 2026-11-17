const mockStartRadio = jest.fn();
jest.mock("@/lib/player/player", () => ({
  startRadio: (...args: unknown[]) => mockStartRadio(...args),
}));

import { renderHook } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { useStartRadio } from "@/hooks/player/use-start-radio";

const station = { seed: { albumIds: ["14"] }, label: "In Rainbows" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useStartRadio", () => {
  it.each([
    { outcome: "started", start: () => "started", toast: null },
    {
      outcome: "offline",
      start: () => "offline",
      toast: "Radio needs a connection",
    },
    {
      outcome: "empty",
      start: () => "empty",
      toast: "No similar music in your Library",
    },
    {
      outcome: "a failed request",
      start: () => Promise.reject(new Error("502")),
      toast: "Couldn't start radio",
    },
  ])("reports $outcome", async ({ start, toast }) => {
    mockStartRadio.mockImplementation(start);
    const { result } = await renderHook(() => useStartRadio());

    await result.current(station);

    expect(mockStartRadio).toHaveBeenCalledWith(station, null);
    if (toast) {
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: toast, preset: "error" }),
      );
    } else {
      expect(Burnt.toast).not.toHaveBeenCalled();
    }
  });
});
