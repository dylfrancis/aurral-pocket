import type { ErrorBoundaryProps } from "expo-router";
import { EditorialPlaylistScreen } from "@/components/discover/EditorialPlaylistScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default EditorialPlaylistScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load playlist" />;
}
