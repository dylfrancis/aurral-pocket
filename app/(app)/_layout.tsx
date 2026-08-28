import { useEffect } from "react";
import { Stack } from "expo-router";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { restoreSavedQueue } from "@/lib/player/player";

export default function AppLayout() {
  // The queue the last session left comes back here, paused. This layout
  // mounts once the session is in place, and the stream URLs need its token.
  useEffect(() => {
    void restoreSavedQueue();
  }, []);

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
