import React, { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, View } from "react-native";

import { Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { TIMER_OFF_SCALE, type TimerScale } from "../../lib/timer-scale-store";

export type TimerProps = {
  /** Base seconds at 1.0× scale; effective budget = ceil(seconds * scale). */
  seconds: number;
  scale: TimerScale;
  /** Fired exactly once when the countdown reaches 0. Skipped at 2× (off). */
  onExpire: () => void;
  /** Optional per-second observer. Not used for backend reporting. */
  onTick?: (remaining: number) => void;
  /** Pause externally — e.g. while the FeedbackPanel is showing. */
  paused?: boolean;
};

const TICK_MS = 1000;

/**
 * Per-item countdown. Drives `onExpire` so the GameContainer can record
 * an "expired" item without the game module having to track time itself.
 *
 * Backgrounding behaviour:
 *   - When AppState goes inactive/background, the interval pauses. We do
 *     NOT decrement on resume to compensate — the user has been away
 *     from the screen and shouldn't be punished for it.
 *   - When AppState returns to active, the countdown resumes from the
 *     value it had at pause time. Combined with the GAME_COMPLETED-only
 *     reporting model this means we can never emit a duplicate timer
 *     event from a background → foreground transition.
 */
export function Timer({ seconds, scale, onExpire, onTick, paused }: TimerProps) {
  const theme = useTheme();
  const off = scale >= TIMER_OFF_SCALE;
  const total = Math.max(1, Math.ceil(seconds * scale));

  const [remaining, setRemaining] = useState(total);
  const [appActive, setAppActive] = useState(true);
  const expiredRef = useRef(false);

  // New item / new scale → fresh countdown.
  useEffect(() => {
    setRemaining(total);
    expiredRef.current = false;
  }, [total]);

  // App-state subscription. JS-only; no native module access.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      setAppActive(s === "active");
    });
    return () => sub.remove();
  }, []);

  // Drive the interval. We deliberately recreate it on every dependency
  // change so a pause/unpause toggle starts a clean tick boundary.
  useEffect(() => {
    if (off || paused || !appActive || expiredRef.current) return;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [off, paused, appActive]);

  // Side-effects react to `remaining` AFTER commit. Keeping these out of
  // the setInterval callback (a) avoids running effects inside a state
  // updater, and (b) means jest fake timers can flush them deterministically.
  useEffect(() => {
    onTick?.(remaining);
  }, [remaining, onTick]);

  useEffect(() => {
    if (off || expiredRef.current) return;
    if (remaining === 0) {
      expiredRef.current = true;
      onExpire();
    }
  }, [remaining, off, onExpire]);

  const lowTime = !off && remaining <= 5;

  return (
    <View
      accessibilityLabel={
        off ? "Timer disabled" : `${remaining} seconds left`
      }
      accessibilityRole="timer"
    >
      <Text variant="caption" tone="muted" style={lowTime ? { color: theme.colors.danger } : undefined}>
        {off ? "—" : `${remaining}s`}
      </Text>
    </View>
  );
}
