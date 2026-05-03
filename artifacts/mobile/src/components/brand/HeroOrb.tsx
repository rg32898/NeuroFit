import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";

export type HeroOrbProps = {
  size?: number;
};

/**
 * Decorative animated orb shown above the hero copy on the welcome screen.
 * Two slowly counter-rotating orbits + a soft pulsing core. Runs on the
 * UI thread via Reanimated so it stays smooth even during JS work.
 *
 * On web we render a static frame because Reanimated's web shim adds
 * noticeable jank during font/SDK boot — the orb still looks great.
 */
export function HeroOrb({ size = 240 }: HeroOrbProps) {
  const rotateA = useSharedValue(0);
  const rotateB = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS === "web") return;
    rotateA.value = withRepeat(
      withTiming(1, { duration: 18000, easing: Easing.linear }),
      -1,
    );
    rotateB.value = withRepeat(
      withTiming(1, { duration: 26000, easing: Easing.linear }),
      -1,
    );
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, rotateA, rotateB]);

  const styleA = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateA.value * 360}deg` }],
  }));
  const styleB = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateB.value * -360}deg` }],
  }));
  const styleCore = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {/* Soft outer halo */}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ position: "absolute" }}
      >
        <Defs>
          <RadialGradient id="orbHalo" cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#818CF8" stopOpacity="0.45" />
            <Stop offset="0.55" stopColor="#6366F1" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#0A0E1A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="100" fill="url(#orbHalo)" />
      </Svg>

      {/* Outer orbit */}
      <Animated.View style={[{ position: "absolute" }, styleA]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="orbitA" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#A5B4FC" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#06B6D4" stopOpacity="0.4" />
            </LinearGradient>
          </Defs>
          <Circle
            cx="100"
            cy="100"
            r="86"
            stroke="url(#orbitA)"
            strokeWidth="1.4"
            strokeDasharray="3 7"
            fill="none"
          />
          <G fill="#A5B4FC">
            <Circle cx="100" cy="14" r="4" />
            <Circle cx="186" cy="100" r="3" opacity={0.7} />
          </G>
        </Svg>
      </Animated.View>

      {/* Inner orbit */}
      <Animated.View style={[{ position: "absolute" }, styleB]}>
        <Svg width={size * 0.74} height={size * 0.74} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="orbitB" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#06B6D4" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#A5B4FC" stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          <Circle
            cx="100"
            cy="100"
            r="76"
            stroke="url(#orbitB)"
            strokeWidth="1.6"
            fill="none"
          />
          <G fill="#06B6D4">
            <Circle cx="24" cy="100" r="4.5" />
            <Circle cx="176" cy="100" r="3" opacity={0.8} />
            <Circle cx="100" cy="24" r="2.5" opacity={0.6} />
          </G>
        </Svg>
      </Animated.View>

      {/* Pulsing core */}
      <Animated.View style={styleCore}>
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="orbCore" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.35" stopColor="#A5B4FC" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#6366F1" stopOpacity="0.85" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="48" fill="url(#orbCore)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
