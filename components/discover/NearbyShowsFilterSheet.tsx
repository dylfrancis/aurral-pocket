export type NearbyShowsSort = "date" | "distance" | "artist";
export type NearbyShowsDateRange = "all" | "weekend" | "next30";
export type NearbyShowsSource = "all" | "library" | "recommended";

export const SORT_OPTIONS: { value: NearbyShowsSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "distance", label: "Distance" },
  { value: "artist", label: "Artist (A–Z)" },
];

export const DATE_RANGE_OPTIONS: {
  value: NearbyShowsDateRange;
  label: string;
}[] = [
  { value: "all", label: "All upcoming" },
  { value: "weekend", label: "This weekend" },
  { value: "next30", label: "Next 30 days" },
];

export const SOURCE_OPTIONS: { value: NearbyShowsSource; label: string }[] = [
  { value: "all", label: "All" },
  { value: "library", label: "Library" },
  { value: "recommended", label: "Recommended" },
];
