import React from "react";
import { View } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";

import { useTheme } from "../../theme";

export type SparkProps = {
  /** Y-values (one per bucket). Must contain at least 1 entry. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour for the polyline. Defaults to theme.primary. */
  color?: string;
  /** Show the latest point as a filled dot. Default true. */
  showLastDot?: boolean;
  /** Optional zero baseline (subtle). Default true. */
  showBaseline?: boolean;
  testID?: string;
};

/**
 * Lightweight SVG sparkline.
 *
 * Pure presentational — no animation, no interaction. Values are scaled
 * so the maximum reaches the top of the canvas with a 4pt padding. A
 * straight horizontal line is drawn when every value is zero (so the
 * empty state is still visually anchored). We deliberately avoid victory
 * / chart libs to keep the bundle lean and the rendering deterministic
 * for tests.
 */
export function Spark({
  values,
  width = 280,
  height = 56,
  color,
  showLastDot = true,
  showBaseline = true,
  testID,
}: SparkProps) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.primary;

  if (values.length === 0) {
    return <View testID={testID} style={{ width, height }} />;
  }

  const padX = 2;
  const padY = 4;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const norm = max === 0 ? 0 : v / max;
    const y = padY + (1 - norm) * innerH;
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const last = points[points.length - 1]!;

  return (
    <View testID={testID} style={{ width, height }}>
      <Svg width={width} height={height}>
        {showBaseline ? (
          <Line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
        ) : null}
        <Path
          d={d}
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {showLastDot ? (
          <Circle cx={last.x} cy={last.y} r={3} fill={stroke} />
        ) : null}
      </Svg>
    </View>
  );
}
