import CalendarToday from "@expo/material-symbols/calendar_today.xml";
import Event from "@expo/material-symbols/event.xml";
import SortByAlpha from "@expo/material-symbols/sort_by_alpha.xml";
import ThumbUp from "@expo/material-symbols/thumb_up.xml";
import type { RecommendedSort } from "@/lib/discover/recommended";

export const RECOMMENDED_SORT_OPTIONS: {
  key: RecommendedSort;
  label: string;
  iosIcon: string;
  androidIcon: number;
}[] = [
  {
    key: "rank",
    label: "Best Match",
    iosIcon: "hand.thumbsup",
    androidIcon: ThumbUp,
  },
  {
    key: "newest",
    label: "Newest First",
    iosIcon: "calendar.badge.clock",
    androidIcon: Event,
  },
  {
    key: "oldest",
    label: "Oldest First",
    iosIcon: "calendar",
    androidIcon: CalendarToday,
  },
  {
    key: "name-asc",
    label: "Name A-Z",
    iosIcon: "textformat.abc",
    androidIcon: SortByAlpha,
  },
  {
    key: "name-desc",
    label: "Name Z-A",
    iosIcon: "textformat.abc",
    androidIcon: SortByAlpha,
  },
];
