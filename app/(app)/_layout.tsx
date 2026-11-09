import { useEffect } from "react";
import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { useQueueFollowsSession } from "@/hooks/player/use-queue-follows-session";
import { startPlayHistory } from "@/lib/player/play-history";
import { restoreSavedQueue } from "@/lib/player/player";

export default function AppLayout() {
  // This layout mounts once the session is in place, and the restored stream
  // URLs need its token.
  useEffect(() => {
    void restoreSavedQueue();
  }, []);

  // Reporting starts with the session too: plays held over from a run that
  // ended offline are sent as soon as there is a token to send them with.
  useEffect(() => startPlayHistory(), []);

  useQueueFollowsSession();
  const reduceMotion = useReducedMotion();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* A native sheet stops short of the top edge, so the full player is a
          transparent modal that draws its own sheet and drag-to-close. */}
      <Stack.Screen
        name="now-playing"
        options={{
          presentation: "transparentModal",
          animation: reduceMotion ? "fade" : "slide_from_bottom",
        }}
      />
    </Stack>
  );
}

// Inherited by every route under (app). Routes that call `useSuspenseQuery`
// render this while the cache warms up. Individual routes can override by
// exporting their own SuspenseFallback.
export function SuspenseFallback() {
  return <ScreenCenter loading />;
}
