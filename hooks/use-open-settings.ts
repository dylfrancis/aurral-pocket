import { useCallback } from "react";
import { useRouter } from "expo-router";

/**
 * Opens Settings, a sheet on iOS and a full screen on Android. A plain path
 * works because no tab has a Settings route to match it first.
 */
export function useOpenSettings() {
  const router = useRouter();
  return useCallback(() => router.push("/settings"), [router]);
}
