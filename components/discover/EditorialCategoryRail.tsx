import { useOpenEditorialCategory } from "@/hooks/discover/use-editorial-playlists";
import { formatPlaylistCount } from "@/lib/discover/format";
import type { EditorialCategory } from "@/lib/types/search";
import { EditorialCard } from "./EditorialCard";
import { EDITORIAL_CARD_SIZE, EditorialRail } from "./EditorialRail";

type Props = {
  title: string;
  categories: EditorialCategory[];
};

export function EditorialCategoryRail({ title, categories }: Props) {
  const openCategory = useOpenEditorialCategory();
  const first = categories[0];

  return (
    <EditorialRail
      title={title}
      onNavigate={first ? () => openCategory(first) : undefined}
    >
      {categories.map((category) => (
        <EditorialCard
          key={category.id}
          name={category.name}
          caption={formatPlaylistCount(category.playlists.length)}
          artworkUrl={category.playlists[0]?.artworkUrl ?? null}
          size={EDITORIAL_CARD_SIZE}
          onPress={() => openCategory(category)}
        />
      ))}
    </EditorialRail>
  );
}
