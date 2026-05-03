/**
 * Tiny module-level flag tracking whether the user is currently inside a
 * workout. Used by `ads.ts` to enforce FR-7.5 (no ad during workout) and
 * by any future code that wants the same gate.
 *
 * Lives outside React state on purpose: the ad SDK call doesn't go
 * through the component tree and we don't want to thread context to it.
 */

let active = false;

export function setWorkoutActive(value: boolean): void {
  active = value;
}

export function isWorkoutActive(): boolean {
  return active;
}

/** Test-only reset. */
export function _resetWorkoutStateForTests(): void {
  active = false;
}
