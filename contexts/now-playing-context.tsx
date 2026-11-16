import { createContext, useContext, useState, type ReactNode } from "react";

type LyricsOpenState = readonly [
  lyricsOpen: boolean,
  setLyricsOpen: (open: boolean) => void,
];

const LyricsOpenContext = createContext<LyricsOpenState | null>(null);

/**
 * Remembers whether the player was showing lyrics, so it reopens on them. It
 * sits above the player's route, which unmounts each time the player closes.
 */
export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const state = useState(false);
  return (
    <LyricsOpenContext.Provider value={state}>
      {children}
    </LyricsOpenContext.Provider>
  );
}

export function useLyricsOpen(): LyricsOpenState {
  const state = useContext(LyricsOpenContext);
  if (!state) {
    throw new Error("useLyricsOpen must be used within NowPlayingProvider");
  }
  return state;
}
