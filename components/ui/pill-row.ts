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
  /** A list makes the pills toggles: a tap on a selected one reaches `onSelect` too. */
  selected: Id | readonly Id[];
  onSelect: (id: Id) => void;
};

export function isPillSelected<Id extends string>(
  selected: Id | readonly Id[],
  id: Id,
): boolean {
  return typeof selected === "string" ? selected === id : selected.includes(id);
}
