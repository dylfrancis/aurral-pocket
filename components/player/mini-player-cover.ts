import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { makeMutable } from "react-native-reanimated";

export const MINI_COVER_RADIUS = 6;

export type LayoutNode = ComponentRef<typeof View>;

/** A square on screen: its top-left corner and side. */
export type CoverFrame = { x: number; y: number; size: number };

export type Point = { x: number; y: number };

/** The tapped mini player, in the coordinates of the view it was measured against. */
export type MiniPlayerFrame = {
  cover: CoverFrame;
  /** The bar's center, which the full player shrinks toward. */
  center: Point;
};

type MiniPlayerNodes = {
  cover: RefObject<LayoutNode | null>;
  bar: RefObject<LayoutNode | null>;
};

let openedFrom: MiniPlayerNodes | null = null;

/**
 * Remembers the mini player that was tapped. iOS 26 renders two copies of the
 * bar and Android one per tab, and only the tapped one is surely on screen, so
 * the player grows out of it and closes back into it.
 */
export function openFromMiniPlayer(nodes: MiniPlayerNodes) {
  openedFrom = nodes;
}

/** Where the tapped mini player sits, relative to `origin`. */
export function locateMiniPlayer(
  origin: LayoutNode | null,
): MiniPlayerFrame | null {
  const base = rectOf(origin);
  const cover = rectOf(openedFrom?.cover.current ?? null);
  const bar = rectOf(openedFrom?.bar.current ?? null);
  if (!base || !cover || !bar) return null;
  return {
    cover: { x: cover.x - base.x, y: cover.y - base.y, size: cover.width },
    center: {
      x: bar.x + bar.width / 2 - base.x,
      y: bar.y + bar.height / 2 - base.y,
    },
  };
}

/** Hides the mini player's own cover while the player's cover flies into it. */
export const miniCoverHidden = makeMutable(false);

/**
 * A synchronous layout read, so an animation never waits a frame on it. Jest's
 * host nodes have no layout, so they read as missing.
 */
function rectOf(node: LayoutNode | null) {
  const rect =
    typeof node?.getBoundingClientRect === "function"
      ? node.getBoundingClientRect()
      : null;
  if (!rect || rect.width === 0) return null;
  return rect;
}
