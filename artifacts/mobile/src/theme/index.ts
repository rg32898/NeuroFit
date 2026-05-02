/**
 * NeuroFit design system. Single source of truth for colors, spacing,
 * radii, typography, and shadows. We intentionally do NOT depend on
 * NativeBase / Paper / Tamagui — every primitive in `components/ui`
 * reads from this module so the visual identity stays under our control.
 *
 * Light + dark palettes mirror each other key-for-key so consumers can
 * call `theme.colors.primary` without checking which mode is active.
 */

import { useColorScheme } from "react-native";

export type Mode = "light" | "dark";

const palette = {
  indigo500: "#6366F1",
  indigo400: "#818CF8",
  cyan500: "#06B6D4",
  red500: "#EF4444",
  amber500: "#F59E0B",
  green500: "#10B981",
  white: "#FFFFFF",
  black: "#000000",
  slate900: "#0A0E1A",
  slate800: "#141929",
  slate700: "#1E2A42",
  slate500: "#64748B",
  slate400: "#94A3B8",
  slate100: "#F1F5F9",
  slate50: "#F8FAFC",
};

export type ColorTokens = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  danger: string;
  dangerFg: string;
  warning: string;
  success: string;
};

const colorsByMode: Record<Mode, ColorTokens> = {
  light: {
    bg: palette.slate50,
    bgElevated: palette.white,
    surface: palette.white,
    surfaceMuted: palette.slate100,
    border: "#E2E8F0",
    text: palette.slate900,
    textMuted: palette.slate500,
    textInverse: palette.white,
    primary: palette.indigo500,
    primaryFg: palette.white,
    accent: palette.cyan500,
    accentFg: palette.white,
    danger: palette.red500,
    dangerFg: palette.white,
    warning: palette.amber500,
    success: palette.green500,
  },
  dark: {
    bg: palette.slate900,
    bgElevated: palette.slate800,
    surface: palette.slate800,
    surfaceMuted: palette.slate700,
    border: palette.slate700,
    text: palette.slate100,
    textMuted: palette.slate400,
    textInverse: palette.slate900,
    primary: palette.indigo500,
    primaryFg: palette.white,
    accent: palette.cyan500,
    accentFg: palette.white,
    danger: palette.red500,
    dangerFg: palette.white,
    warning: palette.amber500,
    success: palette.green500,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Typography uses Inter (loaded via @expo-google-fonts/inter in _layout.tsx).
 * Sizes are in pt; line-heights are absolute (not multipliers) so layouts are
 * deterministic across devices.
 */
export const typography = {
  displayLg: { fontFamily: "Inter_700Bold", fontSize: 34, lineHeight: 40 },
  displayMd: { fontFamily: "Inter_700Bold", fontSize: 28, lineHeight: 34 },
  titleLg: { fontFamily: "Inter_600SemiBold", fontSize: 22, lineHeight: 28 },
  titleMd: { fontFamily: "Inter_600SemiBold", fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: "Inter_400Regular", fontSize: 17, lineHeight: 24 },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
  button: { fontFamily: "Inter_600SemiBold", fontSize: 16, lineHeight: 20 },
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Subtle elevations. We avoid platform-specific shadow APIs — these styles
 * apply to both iOS (shadow*) and Android (elevation) at once.
 */
export const shadows = {
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export type Theme = {
  mode: Mode;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

export function buildTheme(mode: Mode): Theme {
  return {
    mode,
    colors: colorsByMode[mode],
    spacing,
    radii,
    typography,
    shadows,
  };
}

/**
 * Hook returning the active theme. Tracks system appearance — wrap a screen
 * in a manual override later if we add a user setting. Stable identity
 * within a render so it's safe to spread into StyleSheet.create at the top
 * of a component.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return buildTheme(scheme === "light" ? "light" : "dark");
}
