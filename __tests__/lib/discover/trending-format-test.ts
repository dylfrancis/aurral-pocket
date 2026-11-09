import {
  describeMovement,
  formatChartsMeta,
  formatCompactCount,
  formatRegionName,
} from "@/lib/discover/trending-format";

describe("formatCompactCount", () => {
  it.each([
    [950, "950"],
    [1000, "1K"],
    [1250, "1.3K"],
    [12_345, "12K"],
    [999_999, "1M"],
    [1_234_567, "1.2M"],
    [24_129_526, "24M"],
    [3_400_000_000, "3.4B"],
  ])("%d reads %s", (count, expected) => {
    expect(formatCompactCount(count)).toBe(expected);
  });
});

describe("describeMovement", () => {
  it.each([
    [3, "up 3 places"],
    [1, "up 1 place"],
    [-2, "down 2 places"],
    ["new" as const, "new entry"],
    [0, null],
    [null, null],
  ])("%p reads %p", (movement, expected) => {
    expect(describeMovement(movement)).toBe(expected);
  });
});

describe("formatChartsMeta", () => {
  const now = new Date("2026-11-08T18:00:00Z");

  it("names the region and how long ago the charts updated", () => {
    expect(
      formatChartsMeta("GB", now.getTime() - 3 * 60 * 60 * 1000, now),
    ).toBe("United Kingdom · Updated 3 hours ago");
  });

  it("leaves out what the server doesn't know yet", () => {
    expect(formatChartsMeta(null, null, now)).toBeNull();
    expect(formatChartsMeta("US", null, now)).toBe("United States");
  });
});

describe("formatRegionName", () => {
  it("falls back to the code where the engine has no region names", () => {
    // What constructing it throws on an engine without it, as Hermes may be.
    const missing = jest.spyOn(Intl, "DisplayNames").mockImplementation(() => {
      throw new TypeError("Intl.DisplayNames is not a constructor");
    });

    expect(formatRegionName("US")).toBe("US");
    missing.mockRestore();
  });
});
