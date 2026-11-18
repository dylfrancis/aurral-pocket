import type { ErrorBoundaryProps } from "expo-router";
import { PlaylistDetailScreen } from "@/components/flow/PlaylistDetailScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default PlaylistDetailScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load playlist" />;
}
