import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { GameContainer } from "../../games/components/GameContainer";
import { listRegisteredGames } from "../../games/registry";
import type { GameDefinition, GameItem } from "../../games/types";
import { useTimerScale } from "../../lib/timer-scale-store";

/**
 * Dev-only "Storybook-light" harness. Lists every registered game and
 * renders the GameContainer with deterministic mock items so a developer
 * can preview a game without going through the full workout flow.
 *
 * Gated by `__DEV__` at the call site (e.g. a dev menu entry). In a
 * production bundle the export is still importable but the screen will
 * render a "disabled" notice if rendered, defending against accidental
 * inclusion in a release build.
 */
export function GamePreview() {
  const theme = useTheme();
  const scale = useTimerScale();
  const games = useMemo(() => listRegisteredGames(), []);
  const [selected, setSelected] = useState<GameDefinition<unknown, unknown> | null>(
    games[0] ?? null,
  );
  const [score, setScore] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);

  if (!__DEV__) {
    return (
      <Screen>
        <Text variant="body">Game preview is disabled in release builds.</Text>
      </Screen>
    );
  }

  const items: GameItem<unknown>[] = useMemo(() => {
    if (!selected) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${selected.slug}-mock-${i}`,
      gameId: `mock-${selected.slug}`,
      difficultyBand: 1,
      version: 1,
      payload: mockPayloadForSlug(selected.slug, i),
    }));
  }, [selected, runId]);

  return (
    <Screen scrollable>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="titleLg">Game preview</Text>
        <Text variant="caption" tone="muted">
          Current relaxed scale: {scale}×
        </Text>

        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" tone="muted">
              Pick a game
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                {games.map((g) => (
                  <Button
                    key={g.slug}
                    label={g.title}
                    variant={selected?.slug === g.slug ? "primary" : "secondary"}
                    onPress={() => {
                      setSelected(g);
                      setScore(null);
                      setRunId((n) => n + 1);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </Card>

        {selected ? (
          score !== null ? (
            <Card>
              <View style={{ gap: theme.spacing.md }}>
                <Text variant="titleMd">Run finished</Text>
                <Text variant="body">Final score: {score}/100</Text>
                <Button
                  label="Run again"
                  fullWidth
                  onPress={() => {
                    setScore(null);
                    setRunId((n) => n + 1);
                  }}
                />
              </View>
            </Card>
          ) : (
            <GameContainer
              key={`${selected.slug}-${runId}`}
              game={{
                gameId: `mock-${selected.slug}`,
                slug: selected.slug,
                domain: selected.domain,
                title: selected.title,
                averageDurationSec: selected.baseSeconds ?? 30,
                supportsRelaxed: true,
              }}
              relaxedScale={scale}
              onComplete={setScore}
              itemsOverride={items}
              definitionOverride={selected}
            />
          )
        ) : (
          <Text variant="body" tone="muted">
            No games registered.
          </Text>
        )}
      </View>
    </Screen>
  );
}

/** Tiny per-slug payload generator so each registered game gets sensible
 * preview data without the dev having to hand-craft items. */
function mockPayloadForSlug(slug: string, i: number): unknown {
  switch (slug) {
    case "hello":
      return { a: 2 + i, b: 3 + i * 2 };
    default:
      return { index: i };
  }
}
