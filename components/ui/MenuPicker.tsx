import type { MenuPickerProps } from "./menu-picker";

/** Only the .ios and .android versions render: pocket ships no other platform. */
export function MenuPicker<Value extends string>(
  _props: MenuPickerProps<Value>,
) {
  return null;
}
