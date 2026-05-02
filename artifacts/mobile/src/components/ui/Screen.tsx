import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../../theme";

export type ScreenProps = {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Default true. */
  scrollable?: boolean;
  /** Outer padding token. Default 'lg' (16). */
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  /** SafeArea edges. Default ['top', 'left', 'right'] — the tab bar handles bottom. */
  edges?: readonly Edge[];
  /** Add KeyboardAvoidingView wrapper. Default true. */
  keyboardAware?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
};

/**
 * Page-level wrapper that handles SafeArea, padding, scroll, and keyboard
 * avoidance in one place. Every authenticated screen should be `<Screen>…`.
 */
export function Screen({
  children,
  scrollable = true,
  padding = "lg",
  edges = ["top", "left", "right"],
  keyboardAware = true,
  contentContainerStyle,
}: ScreenProps) {
  const theme = useTheme();
  const pad = padding === "none" ? 0 : theme.spacing[padding];

  const inner = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        { padding: pad, gap: theme.spacing.lg, flexGrow: 1 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { padding: pad, gap: theme.spacing.lg }]}>{children}</View>
  );

  const withKeyboard = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.bg }]}
      edges={edges}
    >
      {withKeyboard}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
