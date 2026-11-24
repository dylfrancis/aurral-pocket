import { SectionLayoutEditor } from "@/components/settings/SectionLayoutEditor";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import {
  DEFAULT_ARTIST_PAGE_SECTIONS,
  useArtistPageLayout,
} from "@/hooks/library/use-artist-page-layout";

export function ArtistPageLayoutScreen() {
  const { sections, hydrated, saveLayout } = useArtistPageLayout();

  if (!hydrated) return <ScreenCenter loading />;
  return (
    <SectionLayoutEditor
      sections={sections}
      defaults={DEFAULT_ARTIST_PAGE_SECTIONS}
      onSave={saveLayout}
      scope="For artists in your Library."
    />
  );
}
