export type NearbyShowsDateRange = "all" | "weekend" | "next30";
export type NearbyShowsSource = "all" | "library" | "discover";

export const DATE_RANGE_OPTIONS: {
  key: NearbyShowsDateRange;
  label: string;
}[] = [
  { key: "all", label: "All upcoming" },
  { key: "weekend", label: "This weekend" },
  { key: "next30", label: "Next 30 days" },
];

export const SOURCE_OPTIONS: { key: NearbyShowsSource; label: string }[] = [
  { key: "all", label: "All" },
  { key: "library", label: "Library" },
  { key: "discover", label: "Discover" },
];
