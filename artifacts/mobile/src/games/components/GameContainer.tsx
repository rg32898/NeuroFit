import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { enqueue } from "../../lib/progress-queue";
import type { PlannedGame } from "../../lib/workout-api";
import {
  TIMER_OFF_SCALE,
  type TimerScale,
} from "../../lib/timer-scale-store";
import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { gameRegistry } from "../registry";
import type {
  GameDefinition,
  GameGrade,
  GameItem,
  GameItemResult,
} from "../types";
import { FeedbackPanel } from "./FeedbackPanel";
import { Timer } from "./Timer";

/**
 * Mirrors the server constant `GAME_COMPLETED_EVENT_TYPE` from
 * `@workspace/shared/streak`. We hard-code it here so the mobile bundle
 * doesn't pull a server-only library; if either side drifts the round-
 * trip test in api-server will fail before we ship a mismatch.
 */
const GAME_COMPLETED_EVENT_TYPE = "game_completed";

/** How many items a single game session serves to the user. */
export const ITEMS_PER_SESSION = 5;
const DEFAULT_BASE_SECONDS = 30;

function isTimerScale(v: number): v is TimerScale {
  return v === 1 || v === 1.25 || v === 1.5 || v === 1.75 || v === 2;
}

type ItemResponse = {
  gameId: string;
  slug: string;
  proficiencyScore?: number;
  items: ReadonlyArray<GameItem<unknown>>;
};

export const gameItemsKey = (slug: string, sessionId?: string) =>
  (sessionId
    ? (["games", slug, "items", sessionId] as const)
    : (["games", slug, "items"] as const));

export type GameContainerProps = {
  game: PlannedGame;
  /** Multiplier applied to the per-item timer (1, 1.25, 1.5, 1.75, 2). */
  relaxedScale: number;
  /**
   * Workout/session id this game belongs to. Included in the React Query
   * cache key so two adjacent sessions of the same game slug don't reuse
   * each other's items.
   */
  sessionId?: string;
  /** Called once when the user finishes the game. score ∈ [0, 100]. */
  onComplete: (score: number) => void;
  /**
   * Test/dev escape hatches. In production both are undefined and the
   * container fetches via React Query and looks up the registry. Tests
   * and the GamePreview screen pass these to drive the framework with
   * synthetic data.
   */
  itemsOverride?: ReadonlyArray<GameItem<unknown>>;
  definitionOverride?: GameDefinition<unknown, unknown>;
};

/**
 * Generic per-game host. Owns:
 *
 *   - Item iteration (5 per session by default).
 *   - Per-item start time → durationMs in the result record.
 *   - One GAME_COMPLETED ProgressEvent at the END of the session, with a
 *     payload containing per-item correctness/score. Raw timer ticks are
 *     intentionally NEVER sent — only aggregate item outcomes.
 *   - The FeedbackPanel pause between items.
 *
 * Game modules supply ONLY `Component` + `grade`. They never see the
 * timer or the progress queue directly, which keeps each module ~50 LOC.
 */
export function GameContainer({
  game,
  relaxedScale,
  sessionId,
  onComplete,
  itemsOverride,
  definitionOverride,
}: GameContainerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const definition = (definitionOverride ?? gameRegistry.get(game.slug)) as
    | GameDefinition<unknown, unknown>
    | undefined;

  const itemsQuery = useQuery({
    queryKey: gameItemsKey(game.slug, sessionId),
    enabled: !itemsOverride && !!definition,
    queryFn: async () => {
      const res = await api.get<ItemResponse>(
        `/api/games/${game.slug}/items`,
      );
      return res.items.slice(0, ITEMS_PER_SESSION);
    },
  });

  const timerScale: TimerScale = isTimerScale(relaxedScale) ? relaxedScale : 1;
  const timerOff = timerScale >= TIMER_OFF_SCALE;
  const baseSeconds =
    definition?.baseSeconds ?? game.averageDurationSec ?? DEFAULT_BASE_SECONDS;

  const items: ReadonlyArray<GameItem<unknown>> =
    itemsOverride ?? itemsQuery.data ?? [];

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<GameItemResult[]>([]);
  const [feedback, setFeedback] = useState<{
    grade: GameGrade;
    itemId: string;
  } | null>(null);

  // Per-item start time. `useRef` instead of state — we don't render with
  // it and we want to update it without triggering a re-render.
  const itemStartedAt = useRef<number>(Date.now());
  // Pending result captured at submit time, applied when the user taps
  // Continue on the FeedbackPanel.
  const pendingResult = useRef<GameItemResult | null>(null);
  // Sync completion guard — set BEFORE any async work so a rapid
  // double-final-submit can't double-fire enqueue / onComplete.
  const completed = useRef(false);
  // Sync per-transition guard so a rapid double-tap on a Skip / answer
  // button can't advance the index twice while only one record is stored.
  const transitionInFlight = useRef(false);

  // Reset start clock whenever we move to a new item / leave feedback.
  useEffect(() => {
    if (!feedback) itemStartedAt.current = Date.now();
  }, [index, feedback]);

  const finish = useCallback(
    (final: GameItemResult[]) => {
      if (completed.current) return;
      completed.current = true;
      const totalMax = Math.max(1, final.length) * 1000;
      const totalScore = final.reduce((sum, r) => sum + r.score, 0);
      const score = Math.round((totalScore / totalMax) * 100);
      // Single GAME_COMPLETED event for the whole session. The queue
      // handles offline / retry / dedup via clientEventId.
      void enqueue({
        eventType: GAME_COMPLETED_EVENT_TYPE,
        gameId: game.gameId,
        score,
        payload: { items: final },
      });
      onComplete(score);
    },
    [game.gameId, onComplete],
  );

  const advance = useCallback(
    (record: GameItemResult) => {
      const next = [...results, record];
      setResults(next);
      setFeedback(null);
      pendingResult.current = null;
      if (next.length >= items.length) {
        finish(next);
        return;
      }
      setIndex((i) => i + 1);
      // Release the transition lock on the next macrotask so the new
      // item's mount can't immediately re-enter via a stale reference.
      setTimeout(() => {
        transitionInFlight.current = false;
      }, 0);
    },
    [results, items.length, finish],
  );

  const handleSubmit = useCallback(
    (answer: unknown) => {
      const item = items[index];
      if (
        !item ||
        !definition ||
        feedback ||
        completed.current ||
        transitionInFlight.current
      ) {
        return;
      }
      transitionInFlight.current = true;
      const grade = definition.grade(item, answer);
      const durationMs = Date.now() - itemStartedAt.current;
      pendingResult.current = {
        itemId: item.id,
        correct: grade.correct,
        score: grade.score,
        durationMs,
        skipped: false,
        expired: false,
      };
      setFeedback({ grade, itemId: item.id });
    },
    [items, index, definition, feedback],
  );

  const handleSkip = useCallback(() => {
    const item = items[index];
    if (
      !item ||
      feedback ||
      completed.current ||
      transitionInFlight.current
    ) {
      return;
    }
    transitionInFlight.current = true;
    const durationMs = Date.now() - itemStartedAt.current;
    advance({
      itemId: item.id,
      correct: false,
      score: 0,
      durationMs,
      skipped: true,
      expired: false,
    });
  }, [items, index, feedback, advance]);

  const handleExpire = useCallback(() => {
    const item = items[index];
    if (
      !item ||
      feedback ||
      completed.current ||
      transitionInFlight.current
    ) {
      return;
    }
    transitionInFlight.current = true;
    const durationMs = Date.now() - itemStartedAt.current;
    // Show the explanation so the user still learns from the item, but
    // the result records 0 / expired.
    pendingResult.current = {
      itemId: item.id,
      correct: false,
      score: 0,
      durationMs,
      skipped: false,
      expired: true,
    };
    setFeedback({
      grade: definition?.grade
        ? // Best-effort "incorrect" grade so the panel has an explanation.
          {
            correct: false,
            score: 0,
            explanation: t("gameFramework.timeExpired"),
          }
        : { correct: false, score: 0, explanation: t("gameFramework.timeExpired") },
      itemId: item.id,
    });
  }, [items, index, feedback, definition, t]);

  // Flip the transition lock back off when the FeedbackPanel renders so
  // the user can tap Continue. We only need re-entry protection across
  // the moment between submit-or-skip and feedback-mounted.
  useEffect(() => {
    if (feedback) transitionInFlight.current = false;
  }, [feedback]);

  // ── Render branches ───────────────────────────────────────────────────

  if (!definition) {
    return (
      <Card>
        <Text variant="body">
          {t("gameFramework.unknownGame", { slug: game.slug })}
        </Text>
      </Card>
    );
  }

  if (!itemsOverride && itemsQuery.isLoading) {
    return (
      <Card>
        <Text variant="body" tone="muted">
          {t("gameFramework.loading")}
        </Text>
      </Card>
    );
  }

  if (!itemsOverride && itemsQuery.isError) {
    return (
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="body">{t("gameFramework.loadError")}</Text>
          <Button
            label={t("common.retry")}
            fullWidth
            onPress={() => void itemsQuery.refetch()}
          />
        </View>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <Text variant="body">{t("gameFramework.noItems")}</Text>
      </Card>
    );
  }

  if (feedback) {
    return (
      <FeedbackPanel
        grade={feedback.grade}
        gameItemId={feedback.itemId}
        onContinue={() => {
          const rec = pendingResult.current;
          if (rec) advance(rec);
        }}
      />
    );
  }

  const item = items[index];
  if (!item) {
    // Defensive — should never hit because finish() runs first.
    return null;
  }
  const Component = definition.Component;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="caption" tone="muted">
          {t("gameFramework.progress", {
            current: index + 1,
            total: items.length,
          })}
        </Text>
        {/* Per-item timer. Keyed on the item id so a new item resets the
            countdown cleanly. Pauses while feedback is showing so the
            explanation isn't on a 5-second leash. */}
        <Timer
          key={item.id}
          seconds={baseSeconds}
          scale={timerScale}
          paused={!!feedback}
          onExpire={handleExpire}
        />
      </View>
      <Component
        item={item}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        relaxed={timerScale > 1 || timerOff}
      />
    </View>
  );
}

// Re-exported for tests that want the constant without coupling to the
// shared package.
export const _GAME_COMPLETED_EVENT_TYPE = GAME_COMPLETED_EVENT_TYPE;
export const _DEFAULT_BASE_SECONDS = DEFAULT_BASE_SECONDS;
