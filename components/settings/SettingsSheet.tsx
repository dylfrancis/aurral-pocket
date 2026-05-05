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
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@/hooks/auth/use-logout";
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
  const { user, serverUrl } = useAuth();
  const logoutMutation = useLogout();

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleSignOut = () => {
    dismiss();
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
          {serverUrl ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              {serverUrl}
            </Text>
          ) : null}
          {user?.role ? (
            <Text variant="caption" style={{ color: colors.subtle }}>
              Role: {user.role}
            </Text>
          ) : null}
        </View>

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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    gap: 4,
    paddingBottom: 8,
  },
  welcome: {
    fontSize: 22,
    lineHeight: 28,
  },
});
