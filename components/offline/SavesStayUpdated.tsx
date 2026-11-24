import { useSavesStayUpdated } from "@/hooks/offline/use-saves-stay-updated";

/**
 * Runs useSavesStayUpdated in its own component, so the saves it watches
 * re-render only this, not the layout around every screen.
 */
export function SavesStayUpdated() {
  useSavesStayUpdated();
  return null;
}
