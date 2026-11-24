import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

/** A page section the reader can turn off or move. */
export type LayoutSection = { id: string; label: string; enabled: boolean };

export type SectionLayoutEditorProps<Section extends LayoutSection> = {
  sections: Section[];
  /** What Reset to Default puts back. */
  defaults: readonly Section[];
  onSave: (next: Section[]) => Promise<void>;
  /** A sentence before the how-to, saying where the layout applies. */
  scope?: string;
};

/**
 * Moves the items at `sourceIndices` to `destination`, an index counted
 * before they're taken out, as SwiftUI's onMove reports it.
 */
export function moveItems<T>(
  items: readonly T[],
  sourceIndices: readonly number[],
  destination: number,
): T[] {
  const moving = sourceIndices.map((index) => items[index]);
  const moved: T[] = [];
  items.forEach((item, index) => {
    if (index === destination) moved.push(...moving);
    if (!sourceIndices.includes(index)) moved.push(item);
  });
  if (destination >= items.length) moved.push(...moving);
  return moved;
}

/**
 * The editor's draft of the sections, which changes nothing until Save. Save
 * goes back once the layout is saved, and alerts when it fails.
 */
export function useSectionLayoutDraft<Section extends LayoutSection>({
  sections,
  defaults,
  onSave,
}: Pick<
  SectionLayoutEditorProps<Section>,
  "sections" | "defaults" | "onSave"
>) {
  const router = useRouter();
  // Null until the first change, so a layout that arrives after the page
  // opens, such as the server's, still shows.
  const [draft, setDraft] = useState<Section[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const shown = draft ?? sections;

  const reset = useCallback(() => {
    setDraft(defaults.map((section) => ({ ...section })));
  }, [defaults]);

  const toggle = useCallback(
    (id: string) => {
      setDraft((prev) =>
        (prev ?? sections).map((section) =>
          section.id === id
            ? { ...section, enabled: !section.enabled }
            : section,
        ),
      );
    },
    [sections],
  );

  const reorder = useCallback(
    (move: (current: Section[]) => Section[]) => {
      setDraft((prev) => move(prev ?? sections));
    },
    [sections],
  );

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(shown);
      router.back();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Please try again.";
      Alert.alert("Could not save layout", message);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, router, shown]);

  return { shown, isSaving, toggle, reorder, reset, save };
}
