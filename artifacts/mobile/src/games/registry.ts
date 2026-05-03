/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GameDefinition } from "./types";
import { helloGame } from "./hello";

/**
 * Registry of all built-in games. The runner looks up the matching
 * `GameDefinition` by `PlannedGame.slug`. The `any` type variables here
 * are intentional — at the lookup boundary the payload/answer types are
 * erased; each individual game keeps its own strict typing inside.
 */
export const gameRegistry = new Map<string, GameDefinition<any, any>>();

function register<P, A>(def: GameDefinition<P, A>) {
  gameRegistry.set(def.slug, def as GameDefinition<any, any>);
}

register(helloGame);

/** Diagnostic helper for the dev preview screen. */
export function listRegisteredGames(): ReadonlyArray<GameDefinition<any, any>> {
  return [...gameRegistry.values()];
}

// Test helper — not exported from the public barrel.
export function _registerForTests<P, A>(def: GameDefinition<P, A>): void {
  gameRegistry.set(def.slug, def as GameDefinition<any, any>);
}
