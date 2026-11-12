import { FieldGroup, Host, Icon } from "@expo/ui";
import * as Haptics from "expo-haptics";
import Check from "@expo/material-symbols/check.xml";
import {
  APPEARANCE_LABELS,
  APPEARANCE_OPTIONS,
} from "@/components/settings/appearance";
import {
  SettingsNote,
  useSettingsRow,
} from "@/components/settings/SettingsRows";
import { Colors } from "@/constants/theme";
import { useThemePreference } from "@/contexts/theme-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

const CHECK = Icon.select({ ios: "checkmark", android: Check });

export function AppearanceScreen() {
  const colors = Colors[useColorScheme()];
  const row = useSettingsRow();
  const { preference, setPreference } = useThemePreference();

  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section>
          {APPEARANCE_OPTIONS.map((option) =>
            row({
              key: option,
              label: APPEARANCE_LABELS[option],
              trailing:
                preference === option ? (
                  <Icon name={CHECK} size={16} color={colors.brand} />
                ) : null,
              onPress: () => {
                if (option === preference) return;
                Haptics.selectionAsync();
                void setPreference(option);
              },
            }),
          )}
          <FieldGroup.SectionFooter>
            <SettingsNote>System follows your phone’s appearance.</SettingsNote>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
