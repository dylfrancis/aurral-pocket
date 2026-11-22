import { useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { TranscodingProfileScreen } from "@/components/settings/TranscodingProfileScreen";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

export default function TranscodingProfileRoute() {
  const { network } = useLocalSearchParams<{ network: string }>();
  return network === "cellular" || network === "wifi" ? (
    <TranscodingProfileScreen network={network} />
  ) : null;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary
      {...props}
      message="Failed to load transcoding settings"
    />
  );
}
