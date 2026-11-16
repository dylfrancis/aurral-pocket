import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import {
  isLiveSocketConnected,
  subscribeToLiveChannel,
  subscribeToLiveStatus,
} from "@/lib/api/live-socket";
import type {
  LiveChannel,
  LiveMessage,
  LiveMessageType,
} from "@/lib/types/live";

/**
 * Hears a channel's messages of the given types while mounted. Messages sent
 * while the socket is down are lost, so refetch when `isConnected` turns true.
 */
export function useLiveChannel<
  C extends LiveChannel,
  T extends LiveMessageType<C>,
>(
  channel: C,
  types: readonly T[],
  onMessage: (message: LiveMessage<C, T>) => void,
  { enabled = true }: { enabled?: boolean } = {},
): { isConnected: boolean } {
  const isConnected = useSyncExternalStore(
    subscribeToLiveStatus,
    isLiveSocketConnected,
    isLiveSocketConnected,
  );
  const hear = useEffectEvent(onMessage);
  // Callers pass the types inline, so a new array each render.
  const typesKey = types.join("\n");

  useEffect(() => {
    if (!enabled) return;
    return subscribeToLiveChannel(
      channel,
      typesKey.split("\n") as T[],
      (message) => hear(message),
    );
  }, [channel, typesKey, enabled]);

  return { isConnected: enabled && isConnected };
}
