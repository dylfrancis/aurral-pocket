import type { ErrorBoundaryProps } from "expo-router";
import { EditorialShelfScreen } from "@/components/discover/EditorialShelfScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default EditorialShelfScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load playlists" />;
}
