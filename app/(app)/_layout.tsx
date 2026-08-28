import { useEffect } from "react";
import { Stack } from "expo-router";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* The full player: a full-height sheet over the tabs, opened from
          the mini player. The grabber and the swipe-down dismiss come from
          the native sheet on both platforms. */}
      <Stack.Screen
        name="now-playing"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [1.0],
          sheetGrabberVisible: true,
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
