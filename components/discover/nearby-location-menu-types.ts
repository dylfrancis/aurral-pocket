import type { NearbyLocationMode } from "@/hooks/discover/use-nearby-location-pref";

export type NearbyLocationMenuProps = {
  /** The short place name the trigger shows, like "Cincinnati". */
  cityLabel: string;
  mode: NearbyLocationMode;
  /** The saved ZIP and country, shown under Enter a Location. */
  appliedZip: string;
  appliedCountry: string;
  onSelectYourLocation: () => void;
  onEnterLocation: () => void;
  triggerColor: string;
};

export const YOUR_LOCATION_LABEL = "Your Location";
export const ENTER_LOCATION_LABEL = "Enter a Location…";

/** "45202" or "75001, FR": the saved location, when there is one. */
export function savedLocationSubtitle(zip: string, country: string) {
  const trimmed = zip.trim();
  if (!trimmed) return null;
  return country.trim() ? `${trimmed}, ${country.trim()}` : trimmed;
}
