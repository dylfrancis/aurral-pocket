import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import React from "react";

type ScreenCenterProps = {
  children?: React.ReactNode;
  loading?: boolean;
};

export function ScreenCenter({ children, loading }: ScreenCenterProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View
      testID="screen-center"
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} />
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
