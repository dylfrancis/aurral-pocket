export type SegmentedRowOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SegmentedRowProps<T extends string | number> = {
  value: T;
  options: readonly SegmentedRowOption<T>[];
  onChange: (value: T) => void;
};

/** A value outside the options shows as the first one. */
export function shownSegment<T extends string | number>(
  options: readonly SegmentedRowOption<T>[],
  value: T,
): T | undefined {
  return options.some((option) => option.value === value)
    ? value
    : options[0]?.value;
}
