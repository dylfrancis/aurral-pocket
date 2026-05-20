import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { Chip } from "@/components/ui/Chip";
import {
  useBlocklistMutations,
  useIsArtistBlocked,
} from "@/hooks/discover/use-blocklist";
import { isValidMbid } from "@/lib/blocklist";

type BlockArtistChipProps = {
  mbid: string;
  artistName: string;
};

export function BlockArtistChip({ mbid, artistName }: BlockArtistChipProps) {
  const { blocked, loaded } = useIsArtistBlocked(mbid, artistName);
  const { toggleArtist, isPending } = useBlocklistMutations();

  const doToggle = useCallback(() => {
    toggleArtist({
      mbid: isValidMbid(mbid) ? mbid : null,
      name: artistName || null,
    });
  }, [toggleArtist, mbid, artistName]);

  const onPress = useCallback(() => {
    if (!loaded || isPending) return;
    if (blocked) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      doToggle();
      return;
    }
    Alert.alert(
      `Block ${artistName}?`,
      "They'll be hidden from Discover, Flow, and nearby shows.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
            doToggle();
          },
        },
      ],
    );
  }, [loaded, isPending, blocked, artistName, doToggle]);

  return (
    <Chip
      label={blocked ? "Unblock artist" : "Block artist"}
      icon={blocked ? "ban" : "ban-outline"}
      variant={blocked ? "error" : "neutral"}
      size="md"
      onPress={onPress}
      loading={isPending}
      disabled={!loaded}
    />
  );
}
