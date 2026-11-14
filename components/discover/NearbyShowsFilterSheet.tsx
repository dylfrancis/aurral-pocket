export type NearbyShowsSort = "date" | "distance" | "artist";
export type NearbyShowsDateRange = "all" | "weekend" | "next30";
export type NearbyShowsSource = "all" | "library" | "recommended";

export const SORT_OPTIONS: { key: NearbyShowsSort; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "distance", label: "Distance" },
  { key: "artist", label: "Artist (A–Z)" },
];

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
  { key: "recommended", label: "Recommended" },
];
