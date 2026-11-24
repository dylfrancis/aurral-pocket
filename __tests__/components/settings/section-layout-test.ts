import { moveItems } from "@/components/settings/section-layout";

// SwiftUI's onMove counts the destination before the moved rows come out. The
// Discover layout test covers a move to the end.
describe("moveItems", () => {
  it.each([
    ["down past the next row", [0], 2, ["b", "a", "c", "d"]],
    ["up to the top", [3], 0, ["d", "a", "b", "c"]],
    ["two rows together", [0, 1], 3, ["c", "a", "b", "d"]],
  ])("moves %s", (_name, sourceIndices, destination, expected) => {
    expect(moveItems(["a", "b", "c", "d"], sourceIndices, destination)).toEqual(
      expected,
    );
  });
});
