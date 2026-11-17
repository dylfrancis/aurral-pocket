import type { ErrorBoundaryProps } from "expo-router";
import { EditorialBrowseScreen } from "@/components/discover/EditorialBrowseScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default EditorialBrowseScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load playlists" />;
}
