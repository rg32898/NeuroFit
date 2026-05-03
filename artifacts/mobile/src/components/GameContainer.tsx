/**
 * Re-export shim. The real implementation lives in
 * `src/games/components/GameContainer.tsx` per the framework layout, but
 * the workout runner — and its tests — were wired against this path
 * before the framework existed. Keeping the shim avoids a churny rename
 * and lets jest module mocks at `@app/components/GameContainer` keep
 * working unchanged.
 */
export { GameContainer, gameItemsKey, ITEMS_PER_SESSION } from "../games/components/GameContainer";
export type { GameContainerProps } from "../games/components/GameContainer";
