import { useEffect } from "react";
import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { IS_ANDROID } from "@/constants/platform";
import { useAuth } from "@/contexts/auth-context";
import { useSavedLibraryFollowsSession } from "@/hooks/offline/use-saved-library-follows-session";
import { useQueueFollowsSession } from "@/hooks/player/use-queue-follows-session";
import { startPlayHistory } from "@/lib/player/play-history";
import { restoreSavedQueue } from "@/lib/player/player";

export default function AppLayout() {
  // This layout mounts once the session is in place, and the restored stream
  // URLs need its token.
  useEffect(() => {
    void restoreSavedQueue();
  }, []);

  // Reporting starts with the session and sends what a run that ended offline
  // held over. Each play is saved with its account, so it waits for the user,
  // which can take an /auth/me round trip after launch.
  const userId = useAuth().user?.id;
  useEffect(
    () => (userId === undefined ? undefined : startPlayHistory(userId)),
    [userId],
  );

  useQueueFollowsSession();
  useSavedLibraryFollowsSession();
  const reduceMotion = useReducedMotion();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Activity and Settings are tabs on iOS. Android's bar has no room for
          them, so the same routes open here, above the tabs, from each tab's
          overflow menu. */}
      <Stack.Protected guard={IS_ANDROID}>
        <Stack.Screen name="(activity)" />
        <Stack.Screen name="(settings)" />
      </Stack.Protected>
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
