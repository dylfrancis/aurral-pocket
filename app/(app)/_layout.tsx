import { Stack } from "expo-router";
import { ScreenCenter } from "@/components/ui/ScreenCenter";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

// Inherited by every route under (app). Routes that call `useSuspenseQuery`
// render this while the cache warms up. Individual routes can override by
// exporting their own SuspenseFallback.
export function SuspenseFallback() {
  return <ScreenCenter loading />;
}
