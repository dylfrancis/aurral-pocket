import { useEffect } from "react";
import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { ItemActionsProvider } from "@/components/actions/ItemActionsProvider";
import { SavesStayUpdated } from "@/components/offline/SavesStayUpdated";
import { LockScreenFavorite } from "@/components/player/LockScreenFavorite";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { IS_IOS } from "@/constants/platform";
import { useAuth } from "@/contexts/auth-context";
import { NowPlayingProvider } from "@/contexts/now-playing-context";
import { useDiscoveryUpdates } from "@/hooks/discover/use-discovery-updates";
import { useLibraryUpdates } from "@/hooks/library/use-library-updates";
import { useLiveSocketFollowsSession } from "@/hooks/live/use-live-socket-follows-session";
import { useSavedLibraryFollowsSession } from "@/hooks/offline/use-saved-library-follows-session";
import { usePluginActionResults } from "@/hooks/plugins/use-plugin-actions";
import { useQueueFollowsSession } from "@/hooks/player/use-queue-follows-session";
import { useQueueSync } from "@/hooks/player/use-queue-sync";
import { useSiriVocabulary } from "@/hooks/siri/use-siri-vocabulary";
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
  useQueueSync();
  useSavedLibraryFollowsSession();
  useLiveSocketFollowsSession();
  usePluginActionResults();
  useLibraryUpdates();
  useDiscoveryUpdates();
  useSiriVocabulary();
  const reduceMotion = useReducedMotion();

  return (
    <NowPlayingProvider>
      {/* Long-press sheets for album, artist and playlist tiles in every tab. */}
      <ItemActionsProvider>
        {IS_IOS && <LockScreenFavorite />}
        <SavesStayUpdated />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          {/* Opened from the person button on each tab's first screen. */}
          <Stack.Screen
            name="(settings)"
            options={{ presentation: IS_IOS ? "modal" : "card" }}
          />
          {/* A native sheet stops short of the top edge, so the full player is a
          transparent modal that draws its own sheet and drag-to-close. It
          also animates itself in and out, so its art can travel from and
          back to the mini player. */}
          <Stack.Screen
            name="now-playing"
            options={{
              presentation: "transparentModal",
              animation: reduceMotion ? "fade" : "none",
            }}
          />
        </Stack>
      </ItemActionsProvider>
    </NowPlayingProvider>
  );
}

// Inherited by every route under (app). Routes that call `useSuspenseQuery`
// render this while the cache warms up. Individual routes can override by
// exporting their own SuspenseFallback.
export function SuspenseFallback() {
  return <ScreenCenter loading />;
}
