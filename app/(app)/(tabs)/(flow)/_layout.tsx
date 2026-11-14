import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  DETAIL_SCREEN_OPTIONS,
  stackScreenOptions,
} from "@/constants/navigation";
import { useColors } from "@/hooks/use-colors";

export default function FlowLayout() {
  const colors = useColors();

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors)}>
        <Stack.Screen
          name="index"
          options={{
            title: "Flows",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen name="flow/[id]" options={DETAIL_SCREEN_OPTIONS} />
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
