import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

/**
 * "Relaxed mode" — multiplies the per-item time budget for every game in a
 * workout. The five steps map 1:1 to the spec's 100/125/150/175/200 (off)
 * percentages so the picker UI can render them as `{{scale}}× timer`. At
 * 2.0× the timer is treated as OFF (Timer.tsx never expires).
 *
 * Persisted in AsyncStorage so the choice survives across launches. The
 * tiny external-store API lets any screen render the current scale and
 * re-render automatically when it changes.
 */

const STORAGE_KEY = "nf_timer_scale";

export const TIMER_SCALE_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
export type TimerScale = (typeof TIMER_SCALE_OPTIONS)[number];
const DEFAULT: TimerScale = 1;

/** Sentinel value that disables the per-item countdown entirely. */
export const TIMER_OFF_SCALE: TimerScale = 2;

let current: TimerScale = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isValid(v: unknown): v is TimerScale {
  return TIMER_SCALE_OPTIONS.includes(v as TimerScale);
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = Number.parseFloat(raw);
    if (isValid(parsed) && parsed !== current) {
      current = parsed;
      notify();
    }
  } catch (err) {
    console.warn("timer-scale.hydrate_failed", err);
  }
}

export function getTimerScale(): TimerScale {
  return current;
}

export async function setTimerScale(scale: TimerScale): Promise<void> {
  if (!isValid(scale)) return;
  if (current === scale) return;
  current = scale;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(scale));
  } catch (err) {
    console.warn("timer-scale.persist_failed", err);
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * React hook. First render kicks off hydration; subsequent renders get
 * the latest value via the external-store subscription.
 */
export function useTimerScale(): TimerScale {
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getTimerScale, getTimerScale);
}

// Test helper — not exported from the public barrel.
export function _resetForTests(): void {
  current = DEFAULT;
  hydrated = false;
  listeners.clear();
}
