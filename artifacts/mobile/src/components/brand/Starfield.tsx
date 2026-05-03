import React, { useEffect, useMemo } from "react";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type StarfieldProps = {
  count?: number;
  /** Seed lets us produce a deterministic layout so SSR + hydration match. */
  seed?: number;
};

type Star = {
  top: number; // %
  left: number; // %
  size: number;
  opacity: number;
  delay: number;
};

/**
 * Pseudo-random number generator. Avoids platform RNG flicker between
 * server-render frame and hydrated client frame on web.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decorative twinkling starfield drawn beneath the hero. Uses absolutely
 * positioned dots with reanimated opacity so the GPU can composite the
 * pulse without re-layout. On web we render a static field — Reanimated's
 * web shim is heavy enough that 40 looping animations cause boot jank.
 */
export function Starfield({ count = 38, seed = 1729 }: StarfieldProps) {
  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      top: rand() * 100,
      left: rand() * 100,
      size: 1 + rand() * 2.4,
      opacity: 0.35 + rand() * 0.55,
      delay: rand() * 3000,
    }));
  }, [count, seed]);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {stars.map((s, i) => (
        <Star key={i} star={s} animate={Platform.OS !== "web"} />
      ))}
    </View>
  );
}

function Star({ star, animate }: { star: Star; animate: boolean }) {
  const o = useSharedValue(star.opacity);

  useEffect(() => {
    if (!animate) return;
    o.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(star.opacity * 0.25, {
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [animate, o, star.delay, star.opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: `${star.top}%`,
          left: `${star.left}%`,
          width: star.size,
          height: star.size,
          borderRadius: star.size,
          backgroundColor: "#E0E7FF",
        },
        style,
      ]}
    />
  );
}
