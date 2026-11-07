import { useCallback } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { TRANSPARENT_HEADER } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { useFlowAudioPreview } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function FlowLayout() {
  const colors = Colors[useColorScheme()];
  const { stop } = useFlowAudioPreview();

  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop]),
  );

  return (
    <MiniPlayerHost>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          ...TRANSPARENT_HEADER,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Flows",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen
          name="flow-edit"
          options={{
            title: "Flow",
            headerBackButtonDisplayMode: "minimal",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="worker-settings"
          options={{
            title: "Worker Settings",
            headerBackButtonDisplayMode: "minimal",
            presentation: "card",
          }}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
