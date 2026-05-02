import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  gamesTable,
  gameItemsTable,
  usersTable,
  profilesTable,
} from "@workspace/db/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running the seed script.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function cuid(): string {
  return "c" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const GAMES = [
  {
    slug: "word-burst",
    title: "Word Burst",
    domain: "vocabulary",
    description: "Identify synonyms and definitions under time pressure.",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
  },
  {
    slug: "sentence-forge",
    title: "Sentence Forge",
    domain: "writing",
    description: "Reconstruct scrambled sentences for clarity and flow.",
    averageDurationSec: 120,
    supportsRelaxed: true,
    isFreeTier: false,
  },
  {
    slug: "rapid-reader",
    title: "Rapid Reader",
    domain: "reading",
    description: "Answer comprehension questions after fast reading passages.",
    averageDurationSec: 150,
    supportsRelaxed: true,
    isFreeTier: false,
  },
  {
    slug: "echo-back",
    title: "Echo Back",
    domain: "speaking",
    description: "Repeat increasingly complex phrases with correct phrasing.",
    averageDurationSec: 60,
    supportsRelaxed: false,
    isFreeTier: false,
  },
  {
    slug: "number-chain",
    title: "Number Chain",
    domain: "math",
    description: "Solve chained arithmetic operations against the clock.",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
  },
  {
    slug: "grid-recall",
    title: "Grid Recall",
    domain: "memory",
    description: "Memorise and reproduce a growing grid of symbols.",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
  },
] as const;

type GameSlug = (typeof GAMES)[number]["slug"];

const ITEM_PAYLOADS: Record<GameSlug, (band: number) => Record<string, unknown>> = {
  "word-burst": (band) => ({
    word: ["luminous", "ephemeral", "taciturn", "mendacious", "equivocal"][band - 1],
    choices: ["bright", "temporary", "silent", "lying", "ambiguous"],
    answer: band - 1,
  }),
  "sentence-forge": (band) => ({
    words: ["The", "cat", "sat", "on", "the", "mat"].slice(0, band + 2),
    answer: "The cat sat on the mat",
  }),
  "rapid-reader": (band) => ({
    passage: `Reading passage at difficulty level ${band}.`,
    question: "What was the main topic?",
    answer: "cognition",
  }),
  "echo-back": (band) => ({
    phrase: [
      "Go",
      "Come here",
      "Sit down now",
      "Please open the window",
      "Would you mind closing the door",
    ][band - 1],
  }),
  "number-chain": (band) => ({
    expression: `${band * 3} + ${band * 2} - ${band}`,
    answer: band * 4,
  }),
  "grid-recall": (band) => ({
    grid: Array.from({ length: band * 2 }, (_, i) => i % 4),
    size: band + 2,
  }),
};

async function seed() {
  console.log("Seeding games…");

  const gameRows = GAMES.map((g) => ({
    id: cuid(),
    ...g,
    isPublished: true,
  }));

  await db.insert(gamesTable).values(gameRows).onConflictDoNothing();
  console.log(`  Inserted ${gameRows.length} games.`);

  const itemRows = gameRows.flatMap((game) =>
    ([1, 2, 3, 4, 5] as const).map((band) => ({
      id: cuid(),
      gameId: game.id,
      payload: ITEM_PAYLOADS[game.slug](band),
      difficultyBand: band,
      version: 1,
      isPublished: true,
    })),
  );

  await db.insert(gameItemsTable).values(itemRows).onConflictDoNothing();
  console.log(`  Inserted ${itemRows.length} game items (5 per game).`);

  if (process.env.NODE_ENV !== "production") {
    const demoId = cuid();
    await db
      .insert(usersTable)
      .values({
        id: demoId,
        email: "demo@neurofit.app",
        passwordHash: null,
      })
      .onConflictDoNothing();

    await db
      .insert(profilesTable)
      .values({
        userId: demoId,
        displayName: "Demo User",
        focusDomain: "memory",
        relaxedMode: true,
        timerScale: 100,
      })
      .onConflictDoNothing();

    console.log("  Inserted demo user (demo@neurofit.app).");
  }

  await pool.end();
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
