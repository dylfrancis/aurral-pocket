import type { ComponentProps } from "react";
import type { Button } from "@expo/ui/swift-ui";

export type PillRowItem<Id extends string = string> = {
  id: Id;
  label: string;
  count?: number;
  systemImage?: ComponentProps<typeof Button>["systemImage"];
  /** A Material Symbol for the Android chip. */
  androidIcon?: number;
};

export type PillRowProps<Id extends string = string> = {
  items: readonly PillRowItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
};
