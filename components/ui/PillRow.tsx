import type { PillRowProps } from "./pill-row";

/** Only the .ios and .android versions render: pocket ships no other platform. */
export function PillRow<Id extends string>(_props: PillRowProps<Id>) {
  return null;
}
