import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStreamUrl } from "@/lib/api/flow";

type FlowAudioPreviewContextValue = {
  activeJobId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  toggle: (jobId: string) => void;
  stop: () => void;
};

const FlowAudioPreviewContext =
  createContext<FlowAudioPreviewContextValue | null>(null);

export function FlowAudioPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { token } = useAuth();
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const toggle = useCallback(
    (jobId: string) => {
      if (!token) return;
      if (activeJobId === jobId) {
        if (status.playing) {
          player.pause();
        } else {
          player.play();
        }
        return;
      }
      const url = getFlowStreamUrl(jobId, token);
      try {
        player.replace({ uri: url });
        player.play();
        setActiveJobId(jobId);
      } catch {
        // ignore replace errors; cleared by user changing track
      }
    },
    [activeJobId, player, status.playing, token],
  );

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      // player may not be ready
    }
    setActiveJobId(null);
  }, [player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // unmount path
      }
    };
  }, [player]);

  const value = useMemo<FlowAudioPreviewContextValue>(
    () => ({
      activeJobId,
      isPlaying: !!status.playing,
      isLoading: !!status.isBuffering && !status.playing,
      toggle,
      stop,
    }),
    [activeJobId, status.playing, status.isBuffering, toggle, stop],
  );

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
