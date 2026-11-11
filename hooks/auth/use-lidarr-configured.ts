import { useSignedInHealth } from "./use-signed-in-health";

export function useLidarrConfigured() {
  return useSignedInHealth().data?.lidarrConfigured === true;
}
