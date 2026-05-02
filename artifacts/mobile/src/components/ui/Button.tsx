import React from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "../../theme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
};

/**
 * A single Button primitive — no variants for OutlineButton / TextButton /
 * IconButton etc. that might drift in style. Variant + size live here so
 * the design system stays visually coherent.
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  fullWidth,
  leftIcon,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case "secondary":
        return {
          bg: theme.colors.surfaceMuted,
          fg: theme.colors.text,
          border: theme.colors.border,
        };
      case "ghost":
        return { bg: "transparent", fg: theme.colors.text, border: "transparent" };
      case "danger":
        return {
          bg: theme.colors.danger,
          fg: theme.colors.dangerFg,
          border: theme.colors.danger,
        };
      default:
        return {
          bg: theme.colors.primary,
          fg: theme.colors.primaryFg,
          border: theme.colors.primary,
        };
    }
  })();

  const dims = (() => {
    switch (size) {
      case "sm":
        return { paddingV: theme.spacing.sm, paddingH: theme.spacing.md, minH: 36 };
      case "lg":
        return { paddingV: theme.spacing.lg, paddingH: theme.spacing.xl, minH: 56 };
      default:
        return { paddingV: theme.spacing.md, paddingH: theme.spacing.lg, minH: 48 };
    }
  })();

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: theme.radii.md,
          paddingVertical: dims.paddingV,
          paddingHorizontal: dims.paddingH,
          minHeight: dims.minH,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? "100%" : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={{ marginRight: theme.spacing.sm }}>{leftIcon}</View> : null}
          <Text variant="button" style={{ color: palette.fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
