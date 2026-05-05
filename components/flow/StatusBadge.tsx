import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { FlowJobStatus } from "@/lib/types/flow";

const LABELS: Record<FlowJobStatus, string> = {
  pending: "Queued",
  downloading: "Downloading",
  done: "Ready",
  failed: "Failed",
};

type Props = { status: FlowJobStatus };

export function StatusBadge({ status }: Props) {
  const colors = Colors[useColorScheme()];

  const palette: Record<FlowJobStatus, { bg: string; fg: string }> = {
    pending: { bg: colors.separator, fg: colors.subtle },
    downloading: { bg: colors.brandMuted, fg: colors.brandStrong },
    done: { bg: `${colors.brand}33`, fg: colors.brandStrong },
    failed: { bg: `${colors.error}20`, fg: colors.error },
  };

  const { bg, fg } = palette[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="caption" style={[styles.label, { color: fg }]}>
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.semiBold,
  },
});
