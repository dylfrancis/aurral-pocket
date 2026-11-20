import type { SiriMediaType, SiriSearch } from "@/modules/siri";

export type SiriKind = "song" | "album" | "artist" | "playlist" | "genre";

export type SiriCandidate<T> = {
  kind: SiriKind;
  title: string;
  /** The artist, for songs and albums: "Kid A by Radiohead" matches both. */
  artist?: string | null;
  value: T;
};

export type SiriMatch<T> = SiriCandidate<T> & {
  score: number;
  hasEveryWord: boolean;
};

/**
 * `kinds` is null when Siri didn't say what it heard, as is usual for an app
 * that isn't Apple Music. `searches` go to the server, which matches a title,
 * an artist or an album, never two at once; `words` score what comes back.
 */
export type SiriQuery = {
  words: string[];
  kinds: SiriKind[] | null;
  searches: string[];
  /** "Radiohead radio": a station of what's named, not the thing itself. */
  radio: boolean;
};

export type SiriAsk =
  | { ask: "query"; query: SiriQuery }
  /** Nothing named: "Siri, play Aurral", or "play radio". */
  | { ask: "anything"; radio: boolean }
  /** Podcasts, audiobooks, video. */
  | { ask: "unsupported" };

const KINDS_BY_TYPE: Record<SiriMediaType, SiriKind[] | null | "unsupported"> =
  {
    song: ["song"],
    album: ["album"],
    artist: ["artist"],
    genre: ["genre"],
    playlist: ["playlist"],
    music: null,
    station: null,
    unknown: null,
    other: "unsupported",
  };

/** A tie goes to the kind listed first. */
const KIND_ORDER: SiriKind[] = ["playlist", "artist", "genre", "album", "song"];

/**
 * Below this share of the words heard, a candidate isn't what was asked for.
 * Two words need both, three need two.
 */
const MIN_COVERAGE = 0.6;

export function siriAsk(heard: SiriSearch): SiriAsk {
  const { search, radio } = asStation(withoutAppName(heard));
  const typeKinds = KINDS_BY_TYPE[search.mediaType] ?? null;
  if (typeKinds === "unsupported") return { ask: "unsupported" };

  const genre = search.genres.find((g) => g.trim());
  const suggestion = search.suggested.find((s) => s.title?.trim());
  const primary =
    search.name?.trim() ||
    search.album?.trim() ||
    (typeKinds?.[0] === "genre" ? genre : undefined) ||
    search.artist?.trim() ||
    genre ||
    suggestion?.title?.trim();
  if (!primary) return { ask: "anything", radio };

  const onlyArtist = primary === search.artist?.trim();
  let artist = onlyArtist
    ? undefined
    : (search.artist ??
      (primary === suggestion?.title?.trim() ? suggestion.artist : undefined));
  const searches = [primary];
  let title = primary;
  // Siri often leaves "Kid A by Radiohead" whole. The part before "by" is
  // searched too, since "Stand by Me" is a title.
  const byArtist = artist ? null : /^(.+?)\s+by\s+(.+)$/i.exec(primary);
  if (byArtist) {
    title = byArtist[1];
    artist = byArtist[2];
    searches.push(title);
  }

  const words = tokens(title);
  for (const word of tokens(artist ?? "")) {
    if (!words.includes(word)) words.push(word);
  }
  if (words.length === 0) return { ask: "anything", radio };

  let kinds = typeKinds;
  // "Play songs by Radiohead": the artist is all there is, whatever kind Siri
  // named, and no song is titled "Radiohead".
  if (onlyArtist) kinds = ["artist"];
  if (!kinds && primary === genre && !search.name && !search.album) {
    kinds = ["genre"];
  }
  return { ask: "query", query: { words, kinds, searches, radio } };
}

/** "in Aurral" at the end, or "Aurral" alone. */
const APP_NAME = /(?:^|\s+)(?:(?:in|on|with|using|from)\s+)?aurral\s*$/i;

/**
 * Siri can leave the app's name in what it heard: "play pop in Aurral" comes
 * through named "pop in Aurral", which nothing is called.
 */
function withoutAppName(search: SiriSearch): SiriSearch {
  const strip = (text?: string) =>
    text?.replace(APP_NAME, "").trim() || undefined;
  return {
    ...search,
    name: strip(search.name),
    artist: strip(search.artist),
    album: strip(search.album),
    genres: search.genres.flatMap((genre) => strip(genre) ?? []),
    suggested: search.suggested.map((suggestion) => ({
      ...suggestion,
      title: strip(suggestion.title),
    })),
  };
}

/** "radio" or "station" at the end, or alone. */
const STATION_WORD = /(?:^|\s+)(?:radio|station)\s*$/i;

/**
 * A station of what's named, when Siri names one or the request ends in
 * "radio": "Radiohead radio" is Radiohead's station. The word is dropped, as
 * nothing is called "Radiohead radio".
 */
function asStation(search: SiriSearch): {
  search: SiriSearch;
  radio: boolean;
} {
  let radio = search.mediaType === "station";
  const strip = (text?: string) => {
    if (!text || !STATION_WORD.test(text)) return text;
    radio = true;
    return text.replace(STATION_WORD, "").trim() || undefined;
  };
  const name = strip(search.name);
  const artist = strip(search.artist);
  return { search: { ...search, name, artist }, radio };
}

/** Letters accent folding leaves alone, spelled as Siri writes them. */
const PLAIN_LETTERS: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  ß: "ss",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
};

/**
 * Lowercase words without accents or punctuation, so "Sigur Rós" matches
 * "sigur ros" and "Simon & Garfunkel" matches "simon and garfunkel".
 */
export function tokens(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[æœøßłđðþ]/g, (letter) => PLAIN_LETTERS[letter])
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .split(/[\s\-_.,!?;:()[\]{}"/\\+*#@$%^=|~`<>]+/)
    .filter(Boolean);
}

export function scoreCandidate<T>(
  query: SiriQuery,
  candidate: SiriCandidate<T>,
): SiriMatch<T> | null {
  if (query.kinds && !query.kinds.includes(candidate.kind)) return null;
  const title = tokens(candidate.title);
  if (title.length === 0) return null;
  const titleWords = new Set(title);
  const allWords = new Set([...title, ...tokens(candidate.artist ?? "")]);

  const inTitle = query.words.filter((w) => titleWords.has(w)).length;
  const covered = query.words.filter((w) => allWords.has(w)).length;
  // Siri hears "Radio head" for "Radiohead".
  const sameSpelling = query.words.join("") === title.join("");
  if (inTitle === 0 && !sameSpelling) return null;

  const coverage = sameSpelling ? 1 : covered / query.words.length;
  if (coverage < MIN_COVERAGE) return null;

  // How much of the title was said: "Creep" beats "Creep (Acoustic)".
  const precision = sameSpelling ? 1 : inTitle / title.length;
  const exact = sameSpelling || title.join(" ") === query.words.join(" ");
  return {
    ...candidate,
    score: coverage * 2 + precision + (exact ? 1 : 0),
    hasEveryWord: coverage === 1,
  };
}

/** The best candidate, or null when none is close enough. */
export function bestMatch<T>(
  query: SiriQuery,
  candidates: SiriCandidate<T>[],
): SiriMatch<T> | null {
  let best: SiriMatch<T> | null = null;
  for (const candidate of candidates) {
    const match = scoreCandidate(query, candidate);
    if (match && (!best || beats(match, best))) best = match;
  }
  return best;
}

/** Earlier candidates win ties, so callers list what they prefer first. */
function beats<T>(a: SiriMatch<T>, b: SiriMatch<T>): boolean {
  if (a.score !== b.score) return a.score > b.score;
  return KIND_ORDER.indexOf(a.kind) < KIND_ORDER.indexOf(b.kind);
}

/**
 * Music saved on the phone wins ties: it plays with no network. `library` is
 * null when the server can't be reached.
 */
export function pickSavedFirst<T>(
  saved: SiriMatch<T> | null,
  library: SiriMatch<T> | null,
): SiriMatch<T> | null {
  if (!library) return saved;
  if (!saved) return library;
  return library.score > saved.score ? library : saved;
}
