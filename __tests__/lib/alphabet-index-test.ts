import { buildLetterIndex, indexLetterFor } from "@/lib/alphabet-index";

describe("indexLetterFor", () => {
  it("returns the uppercased first letter", () => {
    expect(indexLetterFor("beck")).toBe("B");
    expect(indexLetterFor("Radiohead")).toBe("R");
  });

  it("ignores a leading article", () => {
    expect(indexLetterFor("The Beatles")).toBe("B");
  });

  it("folds diacritics to their base letter", () => {
    expect(indexLetterFor("Édith Piaf")).toBe("E");
    expect(indexLetterFor("Björk")).toBe("B");
  });

  it("buckets non-Latin names under #", () => {
    expect(indexLetterFor("100 gecs")).toBe("#");
    expect(indexLetterFor("!!!")).toBe("#");
    expect(indexLetterFor("宇多田ヒカル")).toBe("#");
  });
});

describe("buildLetterIndex", () => {
  it("maps each letter to the first matching index", () => {
    const entries = buildLetterIndex([
      "Aphex Twin",
      "Autechre",
      "The Beatles",
      "Beck",
      "Cher",
    ]);
    expect(entries).toEqual([
      { letter: "A", index: 0 },
      { letter: "B", index: 2 },
      { letter: "C", index: 4 },
    ]);
  });

  it("keeps only the first occurrence of a repeated letter", () => {
    const entries = buildLetterIndex(["100 gecs", "Beck", "宇多田ヒカル"]);
    expect(entries).toEqual([
      { letter: "#", index: 0 },
      { letter: "B", index: 1 },
    ]);
  });

  it("returns an empty array for no names", () => {
    expect(buildLetterIndex([])).toEqual([]);
  });
});
