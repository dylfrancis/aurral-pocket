import { createContext, ReactNode, useCallback, useContext } from "react";
import { getFlowStreamUrl } from "@/lib/api/flow";
import { pause, playItem, resume, usePlayerStatus } from "@/lib/player/player";

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
 * Play a finished download job.
 *
 * Jobs run through the same engine as owned tracks and preview clips, so only
 * one of them sounds at a time. The provider holds no player of its own; it
 * reads the engine through the facade. See lib/player/player.ts.
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
        await (status.isPlaying ? pause() : resume());
        return;
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
    [status.currentId, status.isPlaying],
  );

  const stop = useCallback(() => {
    void pause();
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
