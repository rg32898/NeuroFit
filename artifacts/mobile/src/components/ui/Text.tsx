import React from "react";
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";
import { type TypographyVariant, useTheme } from "../../theme";

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  /** Override color token. Defaults to theme.colors.text. */
  tone?: "default" | "muted" | "inverse" | "primary" | "danger";
};

/**
 * Typed Text primitive. Reads font + size from the theme's typography table
 * so callers say `<Text variant="titleLg">…` instead of hand-rolling styles.
 */
export function Text({
  variant = "body",
  tone = "default",
  style,
  ...props
}: TextProps) {
  const theme = useTheme();
  const color = (() => {
    switch (tone) {
      case "muted":
        return theme.colors.textMuted;
      case "inverse":
        return theme.colors.textInverse;
      case "primary":
        return theme.colors.primary;
      case "danger":
        return theme.colors.danger;
      default:
        return theme.colors.text;
    }
  })();
  return (
    <RNText {...props} style={StyleSheet.flatten([theme.typography[variant], { color }, style])} />
  );
}
