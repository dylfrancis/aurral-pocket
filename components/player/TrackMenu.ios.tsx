import { Host } from "@expo/ui";
import type { ComponentProps } from "react";
import { Button, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
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
};

export function TrackMenu({ actions, onAction, triggerColor }: TrackMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label={
          <Image
            systemName="ellipsis"
            size={22}
            color={triggerColor}
            modifiers={[
              // A full-size target, including the glyph's empty space.
              frame({ width: 44, height: 44 }),
              contentShape(shapes.rectangle()),
              accessibilityLabel("More actions"),
            ]}
          />
        }
      >
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.title}
            systemImage={SYMBOLS[action.id]}
            onPress={() => onAction(action.id)}
          />
        ))}
      </Menu>
    </Host>
  );
}
