import QueueMusic from "@expo/material-symbols/queue_music.xml";
import Stars from "@expo/material-symbols/stars.xml";
import ThumbUp from "@expo/material-symbols/thumb_up.xml";
import TrendingUp from "@expo/material-symbols/trending_up.xml";
import { PillRow } from "@/components/ui/PillRow";
import type { PillRowItem } from "@/components/ui/pill-row";
import {
  DISCOVER_TABS,
  type DiscoverTab,
  type DiscoverTabsProps,
} from "./discover-tabs";

const ICONS: Record<
  DiscoverTab,
  Pick<PillRowItem, "systemImage" | "androidIcon">
> = {
  forYou: { systemImage: "sparkles", androidIcon: Stars },
  recommended: { systemImage: "hand.thumbsup", androidIcon: ThumbUp },
  playlists: { systemImage: "music.note.list", androidIcon: QueueMusic },
  trending: {
    systemImage: "chart.line.uptrend.xyaxis",
    androidIcon: TrendingUp,
  },
};

const ITEMS: PillRowItem<DiscoverTab>[] = DISCOVER_TABS.map((tab) => ({
  ...tab,
  ...ICONS[tab.id],
}));

export function DiscoverTabs({ selected, onSelect }: DiscoverTabsProps) {
  return <PillRow items={ITEMS} selected={selected} onSelect={onSelect} />;
}
