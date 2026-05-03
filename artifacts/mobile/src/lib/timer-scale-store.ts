import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

/**
 * "Relaxed mode" — multiplies the per-item time budget for every game in a
 * workout. 1.0× is competitive. 1.5× and 2.0× give the user more thinking
 * time and are intended for older adults, recovery use, or when stress
 * levels are high (FR-7.2).
 *
 * Persisted in AsyncStorage so the choice survives across launches. We
 * expose a tiny store with `useSyncExternalStore` so any screen can render
 * the current scale and re-render automatically when it changes.
 */

const STORAGE_KEY = "nf_timer_scale";

export const TIMER_SCALE_OPTIONS = [1, 1.5, 2] as const;
export type TimerScale = (typeof TIMER_SCALE_OPTIONS)[number];
const DEFAULT: TimerScale = 1;

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
    // Persistence failure is non-fatal — the in-memory value is correct
    // for this session.
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
