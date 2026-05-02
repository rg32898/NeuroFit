import React from "react";
import { View, type ViewProps, StyleSheet } from "react-native";
import { useTheme } from "../../theme";

export type CardProps = ViewProps & {
  /** Add a subtle drop shadow. Default true. */
  elevated?: boolean;
  /** Padding token. Default 'lg' (16). */
  padding?: "none" | "sm" | "md" | "lg" | "xl";
};

export function Card({
  elevated = true,
  padding = "lg",
  style,
  ...rest
}: CardProps) {
  const theme = useTheme();
  const pad = padding === "none" ? 0 : theme.spacing[padding];
  return (
    <View
      {...rest}
      style={StyleSheet.flatten([
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: pad,
        },
        elevated ? theme.shadows.sm : null,
        style,
      ])}
    />
  );
}
