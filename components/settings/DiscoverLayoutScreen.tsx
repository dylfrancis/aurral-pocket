import { SectionLayoutEditor } from "@/components/settings/SectionLayoutEditor";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import {
  DEFAULT_DISCOVER_SECTIONS,
  useDiscoverLayout,
} from "@/hooks/discover/use-discover-layout";

export function DiscoverLayoutScreen() {
  const { sections, hydrated, saveLayout } = useDiscoverLayout();

  if (!hydrated) return <ScreenCenter loading />;
  return (
    <SectionLayoutEditor
      sections={sections}
      defaults={DEFAULT_DISCOVER_SECTIONS}
      onSave={saveLayout}
    />
  );
}
