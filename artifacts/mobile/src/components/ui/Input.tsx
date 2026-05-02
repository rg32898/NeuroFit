import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useTheme } from "../../theme";
import { Text } from "./Text";

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function Input({
  label,
  error,
  helperText,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View>
      {label ? (
        <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={theme.colors.textMuted}
        style={StyleSheet.flatten([
          theme.typography.body,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            minHeight: 48,
          },
          style,
        ])}
      />
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: theme.spacing.xs }}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xs }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
