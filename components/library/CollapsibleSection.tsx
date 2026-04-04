import { useCallback, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsibleSectionProps = {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const colors = Colors[useColorScheme()];
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'),
    );
    setOpen((prev) => !prev);
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.subtle}
        />
        <Text variant="subtitle" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text variant="caption" style={styles.count}>
          {count}
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  title: {
    fontFamily: Fonts.semiBold,
  },
  count: {
    marginLeft: 4,
  },
});
