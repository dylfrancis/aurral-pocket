import { createContext, ReactNode, useCallback, useContext } from "react";
import { getFlowStreamUrl } from "@/lib/api/flow";
import {
  pause,
  pauseClip,
  playItem,
  resume,
  usePlayerStatus,
} from "@/lib/player/player";

type FlowAudioPreviewContextValue = {
  activeJobId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  toggle: (jobId: string) => Promise<void>;
  stop: () => void;
};

const FlowAudioPreviewContext =
  createContext<FlowAudioPreviewContextValue | null>(null);

/**
 * Play a finished download job. Jobs run through the same engine as owned
 * tracks and preview clips, so only one of them sounds at a time.
 */
export function FlowAudioPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const status = usePlayerStatus();

  const toggle = useCallback(
    async (jobId: string) => {
      if (status.currentId === jobId) {
        if (status.isPlaying) {
          await pause();
          return;
        }
        if (status.isPaused) {
          await resume();
          return;
        }
        // Loading: the play is already on its way. Finished: stopped at the
        // end, so fall through and start the job over.
        if (status.isBuffering) return;
      }

      const url = getFlowStreamUrl(jobId);
      if (!url) return;

      await playItem({
        id: jobId,
        title: "Flow preview",
        artist: "Aurral",
        album: "Flow",
        duration: 0,
        url,
        artwork: null,
      });
    },
    [status.currentId, status.isPlaying, status.isPaused, status.isBuffering],
  );

  // pauseClip, not pause: the flow tab fires this whenever it loses focus,
  // and a bare pause would silence album playback on every tab switch away
  // from Playlists.
  const stop = useCallback(() => {
    void pauseClip();
  }, []);

  const value: FlowAudioPreviewContextValue = {
    activeJobId: status.currentId,
    isPlaying: status.isPlaying,
    isLoading: status.isBuffering,
    progress: status.progress,
    toggle,
    stop,
  };

  return (
    <FlowAudioPreviewContext.Provider value={value}>
      {children}
    </FlowAudioPreviewContext.Provider>
  );
}

export function useFlowAudioPreview(): FlowAudioPreviewContextValue {
  const ctx = useContext(FlowAudioPreviewContext);
  if (!ctx) {
    throw new Error(
      "useFlowAudioPreview must be used inside FlowAudioPreviewProvider",
    );
  }
  return ctx;
}
