import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
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
  onSave: (zip: string) => void;
  onClose: () => void;
};

export function NearbyZipEditorSheet({
  visible,
  currentZip,
  onSave,
  onClose,
}: Props) {
  if (!visible) return null;
  return (
    <NearbyZipEditorSheetContent
      currentZip={currentZip}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

function NearbyZipEditorSheetContent({
  currentZip,
  onSave,
  onClose,
}: {
  currentZip: string;
  onSave: (zip: string) => void;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [draft, setDraft] = useState(currentZip);

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
    const trimmed = draft.trim();
    if (!trimmed) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(trimmed);
  }, [draft, onSave]);

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
        <Text
          variant="title"
          style={[styles.title, { fontFamily: Fonts.semiBold }]}
        >
          Set ZIP code
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
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <View style={styles.actions}>
          <Button title="Save" onPress={handleSave} disabled={!draft.trim()} />
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
