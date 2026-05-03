import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Cross-platform tap feedback. On native we use the OS haptic engine; on
 * web we synthesise a short click via the Web Audio API so the moment of
 * commit feels tactile in the browser too. Both code paths are wrapped in
 * try/catch — feedback is purely cosmetic and must never break a tap.
 *
 * NO third-party audio library is used. The Web Audio API is a built-in
 * browser primitive (no vendor dep) and `expo-haptics` is already a
 * project dependency.
 */

let cachedAudioContext: unknown = null;

function getAudioContext(): {
  currentTime: number;
  destination: object;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
} | null {
  if (Platform.OS !== "web") return null;
  const w = globalThis as unknown as {
    AudioContext?: new () => never;
    webkitAudioContext?: new () => never;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!cachedAudioContext) cachedAudioContext = new Ctor();
    return cachedAudioContext as ReturnType<typeof getAudioContext>;
  } catch {
    return null;
  }
}

type OscillatorLike = {
  type: string;
  frequency: { value: number; setValueAtTime: (v: number, t: number) => void };
  connect: (node: object) => void;
  start: (t?: number) => void;
  stop: (t?: number) => void;
};
type GainLike = {
  gain: {
    value: number;
    setValueAtTime: (v: number, t: number) => void;
    exponentialRampToValueAtTime: (v: number, t: number) => void;
  };
  connect: (node: object) => void;
};

function webClick(frequency: number, durationMs: number, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + durationMs / 1000,
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio is best-effort.
  }
}

export function tapPrimary(): void {
  if (Platform.OS === "web") {
    webClick(880, 90, 0.04);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function tapLight(): void {
  if (Platform.OS === "web") {
    webClick(660, 70, 0.025);
    return;
  }
  Haptics.selectionAsync().catch(() => {});
}
