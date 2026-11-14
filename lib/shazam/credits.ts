// Shazam names a song the way the store lists it: "Unholy (feat. Kim Petras)",
// "The Weeknd feat. ROSALÍA". Aurral's library search matches the query as one
// substring of the title, so the featured credit has to come off first.

const FEATURE_WORD = String.raw`(?:feat\.?|ft\.?|featuring)`;

/** "(feat. X)", "[ft. X]" and "(with X)", anywhere in the string. */
const BRACKETED_CREDIT = new RegExp(
  String.raw`\s*[(\[](?:${FEATURE_WORD}|with)\s[^)\]]*[)\]]`,
  "gi",
);

/**
 * " feat. X" to the end of the string, with an optional dash before it. A bare
 * "with" stays, because titles use it ("Dancing with Myself").
 */
const TRAILING_CREDIT = new RegExp(
  String.raw`\s+(?:-\s+)?\b${FEATURE_WORD}\s.*$`,
  "i",
);

const ARTIST_SEPARATOR = /\s*(?:,|&|\bfeat\b\.?|\bft\b\.?|\bfeaturing\b)\s*/i;

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** ASCII punctuation, typographic dashes and quotes, and the ellipsis. */
const PUNCTUATION = /[!-/:-@[-`{-~\u2010-\u2015\u2018-\u201f\u2026]+/g;

/** The title without its featured credits: "Unholy (feat. Kim Petras)" -> "Unholy". */
export function stripFeaturedCredits(text: string): string {
  return text.replace(BRACKETED_CREDIT, "").replace(TRAILING_CREDIT, "").trim();
}

/**
 * Every name a credit string could stand for: the whole credit, then each
 * artist in it. "Sam Smith & Kim Petras" gives all three, so a library album
 * credited to "Sam Smith" still matches.
 */
export function creditedNames(credit: string): string[] {
  const parts = credit.split(ARTIST_SEPARATOR).map((part) => part.trim());
  return [credit.trim(), ...parts].filter(Boolean);
}

/**
 * Text folded for comparison: no featured credits, accents, case or
 * punctuation, and "&" read as "and". "Don’t Start Now" and "Don't Start Now"
 * compare equal; "Blinding Lights (Remix)" and "Blinding Lights" don't.
 */
export function normalizeForMatch(text: string): string {
  return stripFeaturedCredits(text)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}
