import type { ErrorBoundaryProps } from "expo-router";
import { TrendingChartScreen } from "@/components/discover/TrendingChartScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default TrendingChartScreen;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load chart" />;
}
