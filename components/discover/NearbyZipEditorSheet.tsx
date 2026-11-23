import { useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  visible: boolean;
  currentZip: string;
  currentCountry: string;
  /** Once the sheet has gone, so hiding it then can't cut it off. */
  onSave: (zip: string, country: string) => void;
  onClose: () => void;
};

const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;

export function NearbyZipEditorSheet({ visible, ...props }: Props) {
  if (!visible) return null;
  return <NearbyZipEditorSheetContent {...props} />;
}

/** A ZIP or postal code, and the two-letter country the web takes beside it. */
function NearbyZipEditorSheetContent({
  currentZip,
  currentCountry,
  onSave,
  onClose,
}: Omit<Props, "visible">) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const countryRef = useRef<TextInputInstance>(null);
  const sheet = useSheet({ presented: true, onClosed: onClose });
  const [draft, setDraft] = useState(currentZip);
  const [countryDraft, setCountryDraft] = useState(currentCountry);
  const country = countryDraft.trim();
  const canSave =
    !!draft.trim() && (!country || COUNTRY_CODE_PATTERN.test(country));

  const closeSheet = sheet.close;
  const handleSave = useCallback(() => {
    if (!canSave) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const zip = draft.trim();
    const code = country.toUpperCase();
    closeSheet(() => onSave(zip, code));
  }, [canSave, closeSheet, country, draft, onSave]);

  return (
    <AppSheet sheet={sheet} background="card">
      <View style={styles.content}>
        <Text variant="title" style={[styles.title, { ...Fonts.semiBold }]}>
          Enter a Location
        </Text>
        <Text
          variant="caption"
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          Used to find Ticketmaster shows nearby.
        </Text>

        <TextInput
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder="ZIP or postal code"
          placeholderTextColor={colors.placeholder}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => countryRef.current?.focus()}
        />

        <TextInput
          ref={countryRef}
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder="Country code (optional), e.g. FR"
          placeholderTextColor={colors.placeholder}
          value={countryDraft}
          onChangeText={setCountryDraft}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={2}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <View style={styles.actions}>
          <Button title="Save" onPress={handleSave} disabled={!canSave} />
        </View>
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  actions: {
    gap: 8,
  },
});
