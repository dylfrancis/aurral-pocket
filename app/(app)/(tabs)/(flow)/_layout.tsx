import { Stack } from "expo-router";
import { TRANSPARENT_HEADER } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { FlowAudioPreviewProvider } from "@/hooks/flow";

export default function FlowLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <FlowAudioPreviewProvider>
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
            title: "Flow",
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
          name="playlist-edit"
          options={{
            title: "Playlist",
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
    </FlowAudioPreviewProvider>
  );
}
