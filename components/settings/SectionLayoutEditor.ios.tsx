import { Host } from "@expo/ui";
import { Button, List, Section, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled,
  environment,
  frame,
  listRowBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColors } from "@/hooks/use-colors";
import {
  moveItems,
  useSectionLayoutDraft,
  type LayoutSection,
  type SectionLayoutEditorProps,
} from "./section-layout";

/**
 * A page's sections as SwiftUI toggles in a list, always in edit mode so each
 * row shows the system's reorder handle, with Save and Reset to Default.
 */
export function SectionLayoutEditor<PageSection extends LayoutSection>({
  sections,
  defaults,
  onSave,
  scope,
}: SectionLayoutEditorProps<PageSection>) {
  const colors = useColors();
  const { shown, isSaving, toggle, reorder, reset, save } =
    useSectionLayoutDraft({ sections, defaults, onSave });

  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[environment("editMode", "active")]}>
        <Section
          header={
            <Text>
              {`${scope ? `${scope} ` : ""}Toggle sections on or off. Drag ≡ to reorder.`}
            </Text>
          }
        >
          <List.ForEach
            data={shown}
            keyExtractor={(section) => section.id}
            recycling={false}
            onMove={(sourceIndices, destination) =>
              reorder((current) =>
                moveItems(current, sourceIndices, destination),
              )
            }
          >
            {({ item }) => (
              <Toggle
                isOn={item.enabled}
                label={item.label}
                onIsOnChange={() => toggle(item.id)}
                // Without it, the toggle is the system green rather than the
                // brand's.
                modifiers={[tint(colors.brand)]}
              />
            )}
          </List.ForEach>
        </Section>
        <Section>
          <VStack
            spacing={12}
            modifiers={[
              frame({ maxWidth: Infinity }),
              listRowBackground("clear"),
            ]}
          >
            <Button
              label={isSaving ? "Saving…" : "Save"}
              onPress={() => void save()}
              modifiers={[
                buttonStyle("borderedProminent"),
                controlSize("large"),
                tint(colors.brand),
                disabled(isSaving),
              ]}
            />
            <Button
              label="Reset to Default"
              onPress={reset}
              modifiers={[buttonStyle("borderless"), tint(colors.brand)]}
            />
          </VStack>
        </Section>
      </List>
    </Host>
  );
}
