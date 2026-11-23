import { useQuery } from "@tanstack/react-query";
import { getNearbyShows } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";
import { useNearbyLocationPref } from "./use-nearby-location-pref";

/**
 * Nearby shows for the saved location, as the web's `useNearbyShows` reads
 * them. Nothing is fetched until the saved location has loaded, or while a ZIP
 * is picked but not entered.
 */
export function useNearbyShows() {
  const location = useNearbyLocationPref();
  const zip = location.mode === "zip" ? location.appliedZip.trim() : "";
  const country = zip ? location.appliedCountry.trim().toUpperCase() : "";
  const active = location.hydrated && (location.mode !== "zip" || !!zip);

  const query = useQuery({
    queryKey: discoverKeys.nearbyShows(zip, country),
    queryFn: () => getNearbyShows({ zip, country }),
    enabled: active,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });

  const data = active ? query.data : undefined;
  const errorMessage = !active
    ? null
    : data?.location?.resolved === false
      ? "ZIP or postal code not found."
      : query.error
        ? query.error.message || "Please try again."
        : null;

  return {
    ...location,
    data,
    isLoading: !location.hydrated || (active && query.isLoading),
    errorMessage,
    // A disabled query still fetches on refetch, which would ask by address.
    refetch: active ? query.refetch : () => Promise.resolve(undefined),
    locationLabel:
      data?.location?.label || data?.location?.postalCode || "your area",
  };
}
