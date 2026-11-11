import { Host } from "@expo/ui";
import type { ComponentProps } from "react";
import { Button, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  contentShape,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import type {
  TrackMenuActionId,
  TrackMenuProps,
} from "@/components/player/track-menu-types";

type SFSymbol = NonNullable<ComponentProps<typeof Button>["systemImage"]>;

const SYMBOLS: Record<TrackMenuActionId, SFSymbol> = {
  playlist: "text.badge.plus",
  album: "square.stack",
  artist: "music.microphone",
  download: "arrow.down.circle",
  retry: "arrow.clockwise",
  stop: "stop.circle",
  remove: "trash",
};

export function TrackMenu({
  actions,
  onAction,
  triggerColor,
  compact = false,
  accessibilityLabel = "More actions",
}: TrackMenuProps) {
  return (
    // Without this, a Host in a row under the translucent header applies the
    // screen's safe area and draws its trigger below the row.
    <Host matchContents ignoreSafeArea="all">
      <Menu
        label={
          <Image
            systemName="ellipsis"
            size={compact ? 17 : 22}
            color={triggerColor}
            modifiers={[
              // A full-size target, including the glyph's empty space.
              frame({ width: 44, height: 44 }),
              contentShape(shapes.rectangle()),
              accessibilityLabelModifier(accessibilityLabel),
            ]}
          />
        }
      >
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.title}
            systemImage={SYMBOLS[action.id]}
            role={action.destructive ? "destructive" : undefined}
            onPress={() => onAction(action.id)}
          />
        ))}
      </Menu>
    </Host>
  );
}
