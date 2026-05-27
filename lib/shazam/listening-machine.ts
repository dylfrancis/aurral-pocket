import type { ShazamError, ShazamMatch } from "@/modules/shazam";

/**
 * Pure state machine for a Shazam listening session. Kept free of React and the
 * native module so the transitions can be unit-tested in isolation; the hook in
 * `hooks/shazam/use-shazam.ts` drives it with real effects (mic, timers).
 */
export type ShazamStatus =
  | "idle"
  | "listening"
  | "matched"
  | "no_match"
  | "permission_denied"
  | "error";

export type ShazamState = {
  status: ShazamStatus;
  match: ShazamMatch | null;
  errorMessage: string | null;
};

export type ShazamAction =
  | { type: "START" }
  | { type: "MATCH"; match: ShazamMatch }
  | { type: "NO_MATCH" }
  | { type: "TIMEOUT" }
  | { type: "ERROR"; error: ShazamError }
  | { type: "CANCEL" }
  | { type: "RESET" };

export const initialShazamState: ShazamState = {
  status: "idle",
  match: null,
  errorMessage: null,
};

export function shazamReducer(
  state: ShazamState,
  action: ShazamAction,
): ShazamState {
  switch (action.type) {
    case "START":
      return { status: "listening", match: null, errorMessage: null };

    case "MATCH":
      // Ignore late matches that arrive after the session was cancelled/reset.
      if (state.status !== "listening") return state;
      return { status: "matched", match: action.match, errorMessage: null };

    case "NO_MATCH":
    case "TIMEOUT":
      if (state.status !== "listening") return state;
      return { status: "no_match", match: null, errorMessage: null };

    case "ERROR":
      return {
        status:
          action.error.code === "permission" ? "permission_denied" : "error",
        match: null,
        errorMessage: action.error.message,
      };

    case "CANCEL":
    case "RESET":
      return initialShazamState;

    default:
      return state;
  }
}

export const isTerminal = (status: ShazamStatus): boolean =>
  status === "matched" ||
  status === "no_match" ||
  status === "error" ||
  status === "permission_denied";
