import React, { useCallback, useEffect } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { useShazam } from "@/hooks/shazam/use-shazam";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { ShazamListeningIndicator } from "./ShazamListeningIndicator";
import { ShazamMatchResult } from "./ShazamMatchResult";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  /** Navigate to an artist within the host tab's stack. */
  onViewArtist: (mbid: string, name: string) => void;
  /** Open the search tab prefilled with a query. */
  onSearchManually: (query: string) => void;
};

export function ShazamSheet({
  sheetRef,
  onViewArtist,
  onSearchManually,
}: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const shazam = useShazam();
  const { status, start, cancel, reset } = shazam;

  // Keep listening / no-match / error states compact at 55%.
  useEffect(() => {
    if (status === "listening") {
      sheetRef.current?.snapToIndex(0);
    }
  }, [status, sheetRef]);

  // A single-row result (ISRC best match, or a lone name match) stays compact
  // at 55%; a multi-row fallback list needs room, so grow to 90%.
  const handleResolved = useCallback(
    (needsExpandedSheet: boolean) => {
      sheetRef.current?.snapToIndex(needsExpandedSheet ? 1 : 0);
    },
    [sheetRef],
  );

  const handleChange = useCallback(
    (index: number) => {
      if (index >= 0 && status === "idle") {
        start();
      }
    },
    [status, start],
  );

  const handleDismiss = useCallback(() => {
    cancel();
  }, [cancel]);

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    start();
  }, [reset, start]);

  const handleViewArtist = useCallback(
    (mbid: string, name: string) => {
      dismiss();
      onViewArtist(mbid, name);
    },
    [dismiss, onViewArtist],
  );

  const handleSearchManually = useCallback(
    (query: string) => {
      dismiss();
      onSearchManually(query);
    },
    [dismiss, onSearchManually],
  );

  return (
    <AppSheet
      ref={sheetRef}
      snapPoints={["55%", "90%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      onChange={handleChange}
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          paddingTop: 8,
        }}
      >
        {status === "matched" && shazam.match ? (
          <ShazamMatchResult
            match={shazam.match}
            onViewArtist={handleViewArtist}
            onSearchManually={handleSearchManually}
            onResolved={handleResolved}
          />
        ) : status === "permission_denied" ? (
          <CenteredState
            icon="mic-off-outline"
            title="Microphone access needed"
            body="Aurral needs the microphone to identify the song playing around you."
            primaryLabel="Open Settings"
            onPrimary={() => Linking.openSettings()}
            secondaryLabel="Not now"
            onSecondary={dismiss}
          />
        ) : status === "no_match" ? (
          <CenteredState
            icon="help-circle-outline"
            title="Couldn't recognize the song"
            body="Move closer to the source, lower background noise, and try again."
            primaryLabel="Try again"
            onPrimary={handleRetry}
            secondaryLabel="Done"
            onSecondary={dismiss}
          />
        ) : status === "error" ? (
          <CenteredState
            icon="alert-circle-outline"
            title="Something went wrong"
            body={shazam.errorMessage ?? "Please try again."}
            primaryLabel="Try again"
            onPrimary={handleRetry}
            secondaryLabel="Done"
            onSecondary={dismiss}
          />
        ) : (
          <View style={styles.listening}>
            <ShazamListeningIndicator />
            <Text variant="title" style={styles.listeningTitle}>
              Listening…
            </Text>
            <Text
              variant="caption"
              style={[styles.listeningHint, { color: colors.subtle }]}
            >
              Point your phone toward the music
            </Text>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                styles.cancelButton,
                { borderColor: colors.separator, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text variant="body" style={{ color: colors.text }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </BottomSheetScrollView>
    </AppSheet>
  );
}

function CenteredState({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={48} color={colors.subtle} />
      <Text variant="title" style={styles.centeredTitle}>
        {title}
      </Text>
      <Text
        variant="caption"
        style={[styles.centeredBody, { color: colors.subtle }]}
      >
        {body}
      </Text>
      <Pressable
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.brand, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text variant="body" style={styles.primaryButtonText}>
          {primaryLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSecondary}
        style={({ pressed }) => [
          styles.secondaryButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text variant="caption" style={{ color: colors.subtle }}>
          {secondaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  listening: {
    alignItems: "center",
    paddingTop: 16,
    gap: 8,
  },
  listeningTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
  listeningHint: {
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 10,
  },
  centeredTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    textAlign: "center",
    marginTop: 4,
  },
  centeredBody: {
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
  secondaryButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
});
