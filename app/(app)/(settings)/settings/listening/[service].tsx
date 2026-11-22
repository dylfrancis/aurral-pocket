import type { ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export { ListeningServiceScreen as default } from "@/components/settings/ListeningServiceScreen";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary {...props} message="Failed to load this service" />
  );
}
