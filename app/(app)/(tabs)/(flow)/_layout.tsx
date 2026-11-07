import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { TRANSPARENT_HEADER } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function FlowLayout() {
  const colors = Colors[useColorScheme()];

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
          name="flow/[id]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
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
