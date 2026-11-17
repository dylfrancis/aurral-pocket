import type { AlbumEdition } from "@/lib/api/library";

export type EditionPickerProps = {
  editions: readonly AlbumEdition[];
  /** The edition the page shows. It gets the checkmark. */
  selectedId: string;
  /** The Library album's edition, marked In Library. */
  libraryId: string | null;
  onSelect: (editionId: string) => void;
  triggerColor: string;
};
