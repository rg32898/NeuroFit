import React from "react";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

export type LogoProps = {
  size?: number;
  glow?: boolean;
};

/**
 * NeuroFit brand mark — a stylised neuron with synaptic nodes. Uses two
 * gradients (indigo→cyan core, soft violet halo) so the logo reads on
 * both light and dark backgrounds. Pure SVG, no platform-specific deps.
 */
export function Logo({ size = 96, glow = true }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="halo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#818CF8" stopOpacity="0.55" />
          <Stop offset="0.6" stopColor="#6366F1" stopOpacity="0.15" />
          <Stop offset="1" stopColor="#0A0E1A" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="core" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A5B4FC" />
          <Stop offset="0.5" stopColor="#6366F1" />
          <Stop offset="1" stopColor="#06B6D4" />
        </LinearGradient>
        <LinearGradient id="ring" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A5B4FC" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#06B6D4" stopOpacity="0.5" />
        </LinearGradient>
      </Defs>

      {glow ? <Circle cx="50" cy="50" r="48" fill="url(#halo)" /> : null}

      {/* Outer orbit */}
      <Circle
        cx="50"
        cy="50"
        r="36"
        stroke="url(#ring)"
        strokeWidth="1.4"
        fill="none"
        opacity={0.55}
      />

      {/* Synaptic connections */}
      <G stroke="url(#core)" strokeWidth="1.6" strokeLinecap="round" opacity={0.85}>
        <Path d="M50 22 L50 42" />
        <Path d="M22 50 L42 50" />
        <Path d="M58 50 L78 50" />
        <Path d="M50 58 L50 78" />
        <Path d="M30 30 L42 42" />
        <Path d="M70 30 L58 42" />
        <Path d="M30 70 L42 58" />
        <Path d="M70 70 L58 58" />
      </G>

      {/* Outer nodes */}
      <G fill="url(#core)">
        <Circle cx="50" cy="20" r="3.6" />
        <Circle cx="20" cy="50" r="3.6" />
        <Circle cx="80" cy="50" r="3.6" />
        <Circle cx="50" cy="80" r="3.6" />
        <Circle cx="28" cy="28" r="2.4" opacity={0.9} />
        <Circle cx="72" cy="28" r="2.4" opacity={0.9} />
        <Circle cx="28" cy="72" r="2.4" opacity={0.9} />
        <Circle cx="72" cy="72" r="2.4" opacity={0.9} />
      </G>

      {/* Core */}
      <Circle cx="50" cy="50" r="11" fill="url(#core)" />
      <Circle cx="50" cy="50" r="11" fill="#FFFFFF" opacity={0.18} />
      <Circle cx="46" cy="46" r="3" fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}
