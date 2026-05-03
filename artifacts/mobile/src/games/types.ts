import type * as React from "react";

/**
 * Cognitive domains the catalogue and proficiency engine track. Mirrors
 * `lib/shared/src/profile.ts#DOMAINS` exactly — adding a new value here
 * requires the same change server-side.
 */
export type Domain =
  | "vocabulary"
  | "writing"
  | "reading"
  | "speaking"
  | "math"
  | "memory";

/**
 * One-screen tutorial shown the first time a user opens a given game
 * (FR-4.8). Both fields are i18n keys so copy lives in `locales/`.
 */
export type GameTutorialContent = {
  title: string;
  body: string;
};

/**
 * A single playable item served by `/api/games/:slug/items`. The
 * `payload` is game-specific and only the matching `GameDefinition`
 * knows how to render / grade it.
 */
export type GameItem<P> = {
  id: string;
  gameId: string;
  difficultyBand: number;
  version: number;
  payload: P;
};

export type GameGrade = {
  correct: boolean;
  /** Normalised 0..1000 so we can average across heterogeneous games. */
  score: number;
  /** Plain-language explanation surfaced in the FeedbackPanel. */
  explanation: string;
};

export type GameProps<P, A> = {
  item: GameItem<P>;
  onSubmit(answer: A): void;
  onSkip(): void;
  /** True iff the user has chosen any non-1× timer scale. */
  relaxed: boolean;
};

/**
 * The minimal contract every game implements. Everything else (timer,
 * scoring, feedback, item iteration, ProgressEvent reporting) is shared
 * by `GameContainer` and friends.
 */
export type GameDefinition<P, A> = {
  slug: string;
  title: string;
  domain: Domain;
  /** Suggested base seconds at 1.0× scale. Optional; defaults to 30. */
  baseSeconds?: number;
  Component: React.FC<GameProps<P, A>>;
  grade(item: GameItem<P>, answer: A): GameGrade;
  /**
   * Optional one-screen tutorial. When set, GameContainer renders the
   * tutorial the first time the user opens this game and writes a flag
   * to secure-store so it never shows again on this device.
   */
  tutorial?: GameTutorialContent;
};

/**
 * Per-item record stamped onto the GAME_COMPLETED event payload. The
 * server uses these for proficiency tuning and recently-served-item
 * de-duplication; we never send raw timer ticks.
 */
export type GameItemResult = {
  itemId: string;
  correct: boolean;
  /** 0..1000 (0 if skipped or expired). */
  score: number;
  durationMs: number;
  skipped: boolean;
  expired: boolean;
};
