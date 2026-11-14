import type { ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export { PlaybackStorageScreen as default } from "@/components/settings/PlaybackStorageScreen";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary
      {...props}
      message="Failed to load Playback and Storage"
    />
  );
}
