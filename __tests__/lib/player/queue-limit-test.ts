import { limitQueue } from "@/lib/player/queue-limit";

const source = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1) }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("limitQueue", () => {
  it("leaves the queue whole with no limit, or one the source fits under", () => {
    expect(limitQueue(source, "4", 0, false).queue).toBe(source);
    expect(limitQueue(source, "4", 10, true).queue).toBe(source);
  });

  it("in order, takes the tapped track and the ones after it", () => {
    expect(ids(limitQueue(source, "4", 3, false).queue)).toEqual([
      "4",
      "5",
      "6",
    ]);
    // Near the end there are fewer to take.
    expect(ids(limitQueue(source, "9", 3, false).queue)).toEqual(["9", "10"]);
  });

  it("under shuffle, starts with the tapped track and draws the rest from the whole source", () => {
    // Always drawing the last of what's left reaches tracks before the tapped one.
    jest.spyOn(Math, "random").mockReturnValue(0.999);
    const { queue, original } = limitQueue(source, "4", 4, true);
    jest.restoreAllMocks();

    expect(queue).toHaveLength(4);
    expect(queue[0].id).toBe("4");
    expect(new Set(ids(queue)).size).toBe(4);
    expect(ids(queue).some((id) => Number(id) < 4)).toBe(true);
    // Unshuffle puts the same tracks back in the source's order.
    expect(ids(original)).toEqual(
      [...ids(queue)].sort((a, b) => Number(a) - Number(b)),
    );
  });
});
