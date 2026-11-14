import { useCallback, useMemo, type ReactNode } from "react";
import { Icon, ListItem, Row, Text, type IconName } from "@expo/ui";
import ChevronRight from "@expo/material-symbols/chevron_right.xml";
import { useColors } from "@/hooks/use-colors";

const CHEVRON = Icon.select({ ios: "chevron.right", android: ChevronRight });

export type SettingsRowProps = {
  key?: string;
  label: string;
  icon?: IconName;
  value?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Draws the chevron of a row that opens a page. */
  opensPage?: boolean;
  destructive?: boolean;
  /** A button row: the label takes the tint. */
  action?: boolean;
  disabled?: boolean;
};

/**
 * Builds the rows of a Settings page. A section styles its rows by checking
 * that each child is a `ListItem`, and Android wraps anything else in a
 * second row, so this hands back the `ListItem` itself, not a component.
 */
export function useSettingsRow() {
  const colors = useColors();

  return useCallback(
    ({
      key,
      label,
      icon,
      value,
      trailing,
      onPress,
      opensPage,
      destructive,
      action,
      disabled,
    }: SettingsRowProps) => {
      const tint = destructive ? colors.error : colors.brand;
      // Set even for a plain row: Android's text doesn't follow the app's
      // light or dark choice on its own.
      const labelColor = disabled
        ? colors.tertiary
        : destructive || action
          ? tint
          : colors.text;
      const hasTrailing = !!value || trailing != null || !!opensPage;

      return (
        <ListItem
          key={key ?? label}
          onPress={disabled ? undefined : onPress}
          leading={
            icon ? <Icon name={icon} size={20} color={tint} /> : undefined
          }
          trailing={
            hasTrailing ? (
              <Row spacing={6} alignment="center">
                {value ? (
                  <Text numberOfLines={1} textStyle={{ color: colors.subtle }}>
                    {value}
                  </Text>
                ) : null}
                {trailing}
                {opensPage ? (
                  <Icon name={CHEVRON} size={14} color={colors.tertiary} />
                ) : null}
              </Row>
            ) : undefined
          }
        >
          <Text textStyle={{ color: labelColor }}>{label}</Text>
        </ListItem>
      );
    },
    [colors],
  );
}

/**
 * A section's footer text, as the child of `FieldGroup.SectionFooter`: the
 * section finds its footer by that element's type, so it can't be wrapped.
 */
export function SettingsNote({
  children,
  tone,
}: {
  children: string;
  tone?: "warning";
}) {
  const colors = useColors();
  return (
    <Text
      textStyle={{
        fontSize: 13,
        color: tone === "warning" ? colors.warning : colors.subtle,
      }}
    >
      {children}
    </Text>
  );
}

/** Colors for a Settings text field, which Android doesn't take from the app. */
export function useFieldColors() {
  const colors = useColors();
  return useMemo(
    () => ({
      textStyle: { color: colors.text },
      placeholderTextColor: colors.placeholder,
      cursorColor: colors.brand,
    }),
    [colors],
  );
}
