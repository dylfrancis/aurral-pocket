import type { SegmentedRowProps } from "./segmented-row";

/** Only the .ios and .android versions render: pocket ships no other platform. */
export function SegmentedRow<T extends string | number>(
  _props: SegmentedRowProps<T>,
) {
  return null;
}
