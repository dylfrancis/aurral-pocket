import type { ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export { ArtistPageLayoutScreen as default } from "@/components/settings/ArtistPageLayoutScreen";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load Artist Page" />;
}
