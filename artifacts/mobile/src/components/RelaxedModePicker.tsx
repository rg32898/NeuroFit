import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  TIMER_SCALE_OPTIONS,
  type TimerScale,
  setTimerScale,
} from "../lib/timer-scale-store";
import { Button, Card, Text } from "./ui";
import { useTheme } from "../theme";

export type RelaxedModePickerProps = {
  visible: boolean;
  current: TimerScale;
  onClose: () => void;
};

/**
 * Bottom-sheet style modal with three radio options for the timer scale.
 * Selecting an option persists immediately AND closes the sheet — there
 * is no separate Save action so the interaction stays one-tap.
 */
export function RelaxedModePicker({
  visible,
  current,
  onClose,
}: RelaxedModePickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleSelect = async (scale: TimerScale) => {
    await setTimerScale(scale);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={t("relaxed.dismiss")}
        onPress={onClose}
      >
        {/* Inner pressable swallows taps so the user can't accidentally
            dismiss while interacting with the picker. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          onPress={() => undefined}
        >
          <Card>
            <View style={{ gap: theme.spacing.lg }}>
              <Text variant="titleMd">{t("relaxed.title")}</Text>
              <Text variant="body" tone="muted">
                {t("relaxed.subtitle")}
              </Text>
              <View style={{ gap: theme.spacing.sm }}>
                {TIMER_SCALE_OPTIONS.map((scale) => {
                  const selected = scale === current;
                  return (
                    <Button
                      key={scale}
                      label={t("relaxed.option", { scale })}
                      variant={selected ? "primary" : "secondary"}
                      fullWidth
                      onPress={() => void handleSelect(scale)}
                      accessibilityLabel={t("relaxed.option", { scale })}
                      accessibilityState={{ selected }}
                    />
                  );
                })}
              </View>
              <Button
                label={t("relaxed.cancel")}
                variant="ghost"
                fullWidth
                onPress={onClose}
              />
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
