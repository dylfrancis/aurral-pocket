import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStreamSource } from "@/lib/api/flow";

type FlowAudioPreviewContextValue = {
  activeJobId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
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
  const audioModeSet = useRef(false);

  useEffect(() => {
    if (status.didJustFinish) setActiveJobId(null);
  }, [status.didJustFinish]);

  const toggle = useCallback(
    async (jobId: string) => {
      if (!token) return;
      if (!audioModeSet.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        audioModeSet.current = true;
      }
      if (activeJobId === jobId) {
        if (status.playing) {
          player.pause();
        } else {
          player.play();
        }
        return;
      }
      const source = getFlowStreamSource(jobId, token);
      try {
        player.replace(source);
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

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

  const value = useMemo<FlowAudioPreviewContextValue>(
    () => ({
      activeJobId,
      isPlaying: !!status.playing,
      isLoading: !!status.isBuffering && !status.playing,
      progress,
      toggle,
      stop,
    }),
    [activeJobId, status.playing, status.isBuffering, progress, toggle, stop],
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
