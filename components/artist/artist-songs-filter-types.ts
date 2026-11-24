/** Which of an artist's songs the songs section lists. */
export type ArtistSongsShow = "everything" | "library" | "saved";

export const ARTIST_SONGS_SHOW_OPTIONS: readonly {
  value: ArtistSongsShow;
  label: string;
}[] = [
  { value: "everything", label: "Everything" },
  { value: "library", label: "In Library" },
  { value: "saved", label: "Saved Offline" },
];

export type ArtistSongsFilterProps = {
  value: ArtistSongsShow;
  onChange: (value: ArtistSongsShow) => void;
};

export function artistSongsFilterLabel(value: ArtistSongsShow) {
  const option = ARTIST_SONGS_SHOW_OPTIONS.find((o) => o.value === value);
  return value === "everything" || !option
    ? "Filter songs"
    : `Filter songs, ${option.label}`;
}
