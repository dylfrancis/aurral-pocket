import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useYourRadio } from "@/hooks/discover/use-your-radio";
import { useColors } from "@/hooks/use-colors";
import { useIsOffline } from "@/lib/offline/network";

const ICON_SIZE = 44;

export function YourRadioCard() {
  const colors = useColors();
  const isOffline = useIsOffline();
  const { start, isStarting } = useYourRadio();
  const disabled = isOffline || isStarting;

  return (
    <Card bordered style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.brandMuted }]}>
        <Ionicons name="radio-outline" size={22} color={colors.brandStrong} />
      </View>
      <View style={styles.text}>
        <Text variant="body" style={[styles.title, { color: colors.text }]}>
          Your Radio
        </Text>
        <Text variant="caption" numberOfLines={1}>
          From what you&apos;ve played
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play Your Radio"
        accessibilityState={{ disabled, busy: isStarting }}
        disabled={disabled}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          void start();
        }}
        style={({ pressed }) => [
          styles.play,
          {
            backgroundColor: colors.brand,
            opacity: isOffline ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {isStarting ? (
          <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
        ) : (
          <Ionicons name="play" size={16} color={colors.buttonPrimaryText} />
        )}
        <Text
          variant="body"
          style={[styles.playLabel, { color: colors.buttonPrimaryText }]}
        >
          Play
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: Radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
  play: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: Radius.round,
  },
  playLabel: {
    ...Fonts.semiBold,
  },
});
