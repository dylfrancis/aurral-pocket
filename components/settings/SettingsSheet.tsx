import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { PasswordSection } from "@/components/settings/sections/PasswordSection";
import { AboutSection } from "@/components/settings/sections/AboutSection";
import { LinksSection } from "@/components/settings/sections/LinksSection";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@/hooks/auth/use-logout";
import { useSession } from "@/hooks/auth/use-session";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { setAuthToken } from "@/lib/api/client";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onClose?: () => void;
};

export function SettingsSheet({ sheetRef, onClose }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const logoutMutation = useLogout();

  useSession();

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleSignOut = () => {
    sheetRef.current?.dismiss();
    logoutMutation.mutate();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          <Text
            variant="title"
            style={[
              styles.welcome,
              { color: colors.text, fontFamily: Fonts.bold },
            ]}
          >
            Welcome, {user?.username}
          </Text>
          {user?.role ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              Role: {user.role}
            </Text>
          ) : null}
        </View>

        <SectionHeading title="Account" />
        <AccountSection />

        <View style={[styles.divider, { backgroundColor: colors.separator }]} />
        <PasswordSection />

        <SectionHeading title="About" />
        <AboutSection />

        <SectionHeading title="Links" />
        <LinksSection />

        <View style={styles.signOut}>
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            loading={logoutMutation.isPending}
          />
          {__DEV__ ? (
            <Button
              title="Invalidate Session (debug)"
              variant="inline"
              onPress={() => setAuthToken("invalid-token-for-testing")}
            />
          ) : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function SectionHeading({ title }: { title: string }) {
  const colors = Colors[useColorScheme()];
  return (
    <Text
      variant="caption"
      style={[
        styles.sectionHeading,
        { color: colors.subtle, fontFamily: Fonts.semiBold },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  header: {
    gap: 4,
    paddingBottom: 16,
  },
  welcome: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionHeading: {
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  signOut: {
    marginTop: 28,
    gap: 8,
  },
});
