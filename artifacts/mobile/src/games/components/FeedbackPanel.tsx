import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { api, ApiError } from "../../lib/api";
import type { GameGrade } from "../types";

const REPORT_CATEGORIES = [
  "inappropriate",
  "broken",
  "incorrect",
  "spam",
  "copyright",
  "other",
] as const;
type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type FeedbackPanelProps = {
  grade: GameGrade;
  /** The item being reported on — required by /api/reports/content. */
  gameItemId: string;
  onContinue: () => void;
};

/**
 * Shown after every graded item. The user always taps Continue to advance
 * — we never auto-advance because the explanation is a teaching moment.
 *
 * "Report a problem" (FR-4.4) opens a modal that POSTs to
 * /api/reports/content. The server de-dupes (reporter, item, 24h) so we
 * don't need any client-side throttling.
 */
export function FeedbackPanel({
  grade,
  gameItemId,
  onContinue,
}: FeedbackPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text
          variant="caption"
          tone="muted"
          style={{
            color: grade.correct ? theme.colors.primary : theme.colors.danger,
          }}
        >
          {t(grade.correct ? "feedback.correct" : "feedback.incorrect")}
        </Text>
        <Text variant="body">{grade.explanation}</Text>
        <Button
          label={t("feedback.continue")}
          fullWidth
          onPress={onContinue}
          accessibilityLabel={t("feedback.continue")}
        />
        <Button
          label={t("feedback.report")}
          variant="ghost"
          fullWidth
          onPress={() => setReportOpen(true)}
          accessibilityLabel={t("feedback.report")}
        />
      </View>
      <ReportSheet
        visible={reportOpen}
        gameItemId={gameItemId}
        onClose={() => setReportOpen(false)}
      />
    </Card>
  );
}

type ReportSheetProps = {
  visible: boolean;
  gameItemId: string;
  onClose: () => void;
};

function ReportSheet({ visible, gameItemId, onClose }: ReportSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCategory(null);
    setMessage("");
    setSubmitting(false);
    setDone(false);
    setError(null);
  };

  const handleClose = () => {
    onClose();
    // Defer reset so the dismiss animation doesn't flash the empty state.
    setTimeout(reset, 250);
  };

  const handleSubmit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/reports/content", {
        gameItemId,
        category,
        message: message.trim() || `Reported via in-game flow: ${category}`,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("common.error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={t("report.dismiss")}
        onPress={handleClose}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          onPress={() => undefined}
        >
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="titleMd">{t("report.title")}</Text>
              <Text variant="body" tone="muted">
                {t("report.subtitle")}
              </Text>

              {done ? (
                <>
                  <Text variant="body">{t("report.success")}</Text>
                  <Button
                    label={t("report.close")}
                    fullWidth
                    onPress={handleClose}
                  />
                </>
              ) : (
                <>
                  <View style={{ gap: theme.spacing.xs }}>
                    {REPORT_CATEGORIES.map((c) => (
                      <Button
                        key={c}
                        label={t(`report.categories.${c}`)}
                        variant={category === c ? "primary" : "secondary"}
                        fullWidth
                        onPress={() => setCategory(c)}
                        accessibilityLabel={t(`report.categories.${c}`)}
                        accessibilityState={{ selected: category === c }}
                      />
                    ))}
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder={t("report.messagePlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={3}
                    accessibilityLabel={t("report.messagePlaceholder")}
                  />
                  {error ? (
                    <Text variant="caption" tone="muted">
                      {error}
                    </Text>
                  ) : null}
                  <Button
                    label={t("report.submit")}
                    fullWidth
                    disabled={!category || submitting}
                    onPress={() => void handleSubmit()}
                    accessibilityLabel={t("report.submit")}
                  />
                  <Button
                    label={t("report.cancel")}
                    variant="ghost"
                    fullWidth
                    onPress={handleClose}
                  />
                </>
              )}
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    textAlignVertical: "top",
  },
});
