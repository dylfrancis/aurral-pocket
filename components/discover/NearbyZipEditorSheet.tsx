import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  StyleSheet,
  type TextInputInstance,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  visible: boolean;
  currentZip: string;
  currentCountry: string;
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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const countryRef = useRef<TextInputInstance>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [draft, setDraft] = useState(currentZip);
  const [countryDraft, setCountryDraft] = useState(currentCountry);
  const country = countryDraft.trim();
  const canSave =
    !!draft.trim() && (!country || COUNTRY_CODE_PATTERN.test(country));

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex === 0) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(draft.trim(), country.toUpperCase());
  }, [canSave, country, draft, onSave]);

  return (
    <AppSheet
      ref={sheetRef}
      background="card"
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onAnimate={handleAnimate}
      onDismiss={handleDismiss}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        <Text variant="title" style={[styles.title, { ...Fonts.semiBold }]}>
          Enter a Location
        </Text>
        <Text
          variant="caption"
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          Used to find Ticketmaster shows nearby.
        </Text>

        <BottomSheetTextInput
          ref={inputRef as never}
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder="ZIP or postal code"
          placeholderTextColor={colors.placeholder}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => countryRef.current?.focus()}
        />

        <BottomSheetTextInput
          ref={countryRef as never}
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
      </BottomSheetView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
