import type { ErrorBoundaryProps } from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export { AppearanceScreen as default } from "@/components/settings/AppearanceScreen";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load Appearance" />;
}
