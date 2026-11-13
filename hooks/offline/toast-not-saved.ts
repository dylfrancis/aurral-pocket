import * as Burnt from "burnt";

/** Android shows a toast's title alone, so the title carries the reason. */
export function toastNotSaved() {
  Burnt.toast({
    title: "Not saved on this phone",
    message: "You're offline. What's saved on the phone still plays.",
    preset: "error",
  });
}
