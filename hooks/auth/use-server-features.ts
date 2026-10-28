import { useServerHealth } from "@/hooks/auth/use-server-health";
import type { ServerFeature } from "@/lib/types/auth";

const NO_FEATURES: ServerFeature[] = [];

/**
 * App contract features the configured server implements. Gate a capability on
 * its feature name, not on `appVersion`. Empty until bootstrap loads, and for a
 * server that sends no `api` block.
 */
export function useServerFeatures(): ServerFeature[] {
  const { data } = useServerHealth();
  return data?.api?.features ?? NO_FEATURES;
}
