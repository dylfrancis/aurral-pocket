import {
  initialShazamState,
  isTerminal,
  shazamReducer,
  type ShazamState,
} from "@/lib/shazam/listening-machine";
import type { ShazamMatch } from "@/modules/shazam";

const MATCH: ShazamMatch = {
  title: "Bohemian Rhapsody",
  artist: "Queen",
  album: null,
  artworkUrl: "https://example.com/art.jpg",
  appleMusicUrl: null,
  isrc: "GBUM71029604",
  shazamId: "12345",
};

const listening: ShazamState = {
  status: "listening",
  match: null,
  errorMessage: null,
};

describe("shazamReducer", () => {
  it("START moves to listening and clears prior match/error", () => {
    const dirty: ShazamState = {
      status: "error",
      match: MATCH,
      errorMessage: "boom",
    };
    expect(shazamReducer(dirty, { type: "START" })).toEqual(listening);
  });

  it("MATCH from listening transitions to matched with the match", () => {
    const next = shazamReducer(listening, { type: "MATCH", match: MATCH });
    expect(next).toEqual({
      status: "matched",
      match: MATCH,
      errorMessage: null,
    });
  });

  it("ignores a MATCH that arrives when not listening (late/cancelled)", () => {
    const next = shazamReducer(initialShazamState, {
      type: "MATCH",
      match: MATCH,
    });
    expect(next).toBe(initialShazamState);
  });

  it.each(["NO_MATCH", "TIMEOUT"] as const)(
    "%s from listening transitions to no_match",
    (type) => {
      expect(shazamReducer(listening, { type }).status).toBe("no_match");
    },
  );

  it("ignores NO_MATCH/TIMEOUT when not listening", () => {
    expect(shazamReducer(initialShazamState, { type: "NO_MATCH" })).toBe(
      initialShazamState,
    );
  });

  it("a permission error becomes permission_denied", () => {
    const next = shazamReducer(listening, {
      type: "ERROR",
      error: { code: "permission", message: "Microphone permission denied" },
    });
    expect(next.status).toBe("permission_denied");
    expect(next.errorMessage).toBe("Microphone permission denied");
  });

  it.each(["unavailable", "token", "error"] as const)(
    "a %s error becomes the generic error state",
    (code) => {
      const next = shazamReducer(listening, {
        type: "ERROR",
        error: { code, message: "nope" },
      });
      expect(next.status).toBe("error");
      expect(next.errorMessage).toBe("nope");
    },
  );

  it.each(["CANCEL", "RESET"] as const)(
    "%s returns to the initial state",
    (type) => {
      const matched: ShazamState = {
        status: "matched",
        match: MATCH,
        errorMessage: null,
      };
      expect(shazamReducer(matched, { type })).toEqual(initialShazamState);
    },
  );
});

describe("isTerminal", () => {
  it("treats result states as terminal", () => {
    expect(isTerminal("matched")).toBe(true);
    expect(isTerminal("no_match")).toBe(true);
    expect(isTerminal("error")).toBe(true);
    expect(isTerminal("permission_denied")).toBe(true);
  });

  it("treats idle and listening as non-terminal", () => {
    expect(isTerminal("idle")).toBe(false);
    expect(isTerminal("listening")).toBe(false);
  });
});
