import type { ErrorBoundaryProps } from "expo-router";
import { FavoritesScreen } from "@/components/library/FavoritesScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default FavoritesScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load favorites" />;
}
