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

/**
 * Catalogue (Prompt 15). One game per primary cognitive domain. Each
 * game's payload schema matches the `GameDefinition` in the matching
 * mobile module exactly — drift between the two would surface as a
 * grade-time crash, so keep them in lockstep.
 */
const GAMES = [
  {
    slug: "synonym-match",
    title: "Synonym Match",
    domain: "vocabulary",
    description: "Pick the closest synonym for a target word.",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
  },
  {
    slug: "mental-arith",
    title: "Mental Arithmetic",
    domain: "math",
    description: "Solve short arithmetic expressions in your head.",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
  },
  {
    slug: "pairs-recall",
    title: "Pairs Recall",
    domain: "memory",
    description: "Memorise a 4x4 grid of word pairs and recall positions.",
    averageDurationSec: 120,
    supportsRelaxed: true,
    isFreeTier: true,
  },
  {
    slug: "reading-detail",
    title: "Reading Detail",
    domain: "reading",
    description: "Read a short passage and answer detail questions.",
    averageDurationSec: 150,
    supportsRelaxed: true,
    isFreeTier: false,
  },
] as const;

type GameSlug = (typeof GAMES)[number]["slug"];

// ── Per-slug item content ────────────────────────────────────────────────
//
// Five well-formed items per game (one per difficulty band 1..5). The
// mobile app NEVER hard-codes any of this content — it always comes from
// the API.

const SYNONYM_ITEMS = [
  {
    word: "happy",
    options: ["sad", "glad", "angry", "tired"],
    answer: 1,
  },
  {
    word: "begin",
    options: ["end", "stop", "start", "pause"],
    answer: 2,
  },
  {
    word: "swift",
    options: ["slow", "fast", "heavy", "wide"],
    answer: 1,
  },
  {
    word: "elated",
    options: ["overjoyed", "despondent", "weary", "calm"],
    answer: 0,
  },
  {
    word: "petulant",
    options: ["serene", "cheerful", "irritable", "wise"],
    answer: 2,
  },
] as const;

const MENTAL_ARITH_ITEMS = [
  { expression: "3 + 4", answer: 7 },
  { expression: "12 - 5", answer: 7 },
  { expression: "8 + 17 - 6", answer: 19 },
  { expression: "25 - 13 + 8", answer: 20 },
  // Intermediate goes negative; final answer is also negative — exercises
  // the "no negative-number trap" requirement.
  { expression: "5 - 8 - 2", answer: -5 },
] as const;

/** Build a deterministic 4×4 grid where each of 8 unique words appears 2×. */
function buildPairsGrid(words: ReadonlyArray<string>, seed: number): string[][] {
  if (words.length !== 8) {
    throw new Error(`Pairs grid needs exactly 8 unique words, got ${words.length}`);
  }
  const cells = [...words, ...words];
  // Deterministic shuffle by seed so re-running the seed gives the same grid.
  const sorted = cells
    .map((w, i) => ({ w, k: ((i + 1) * 2654435761 + seed) >>> 0 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.w);
  return [
    sorted.slice(0, 4),
    sorted.slice(4, 8),
    sorted.slice(8, 12),
    sorted.slice(12, 16),
  ];
}

const PAIRS_RECALL_ITEMS = [
  buildPairsGrid(["sun", "moon", "star", "cloud", "rain", "snow", "wind", "leaf"], 1),
  buildPairsGrid(["cat", "dog", "fish", "bird", "ant", "bee", "fox", "owl"], 2),
  buildPairsGrid(["red", "blue", "green", "gold", "pink", "grey", "teal", "lime"], 3),
  buildPairsGrid(["river", "lake", "hill", "wood", "rock", "moss", "sand", "snow"], 4),
  buildPairsGrid(["piano", "drum", "flute", "harp", "viola", "tuba", "lute", "oboe"], 5),
].map((grid) => ({ grid }));

const READING_DETAIL_ITEMS = [
  {
    passage:
      "Otters use small stones to crack open shells. They store a favourite stone in a flap of skin under the foreleg and bring it out at meal times.",
    questions: [
      {
        q: "What do otters use stones for?",
        options: ["Building dams", "Cracking shells", "Marking territory", "Sharpening teeth"],
        answer: 1,
      },
      {
        q: "Where do otters keep their favourite stone?",
        options: [
          "In a riverbank burrow",
          "Under a foreleg flap of skin",
          "In their mouth",
          "Wrapped in seaweed",
        ],
        answer: 1,
      },
    ],
  },
  {
    passage:
      "The first lighthouse on Eddystone Reef, off Plymouth, was built in 1698 of wood and lasted only five years before a great storm carried it away.",
    questions: [
      {
        q: "When was the first Eddystone lighthouse built?",
        options: ["1598", "1698", "1798", "1898"],
        answer: 1,
      },
      {
        q: "How was the first lighthouse destroyed?",
        options: ["Fire", "A storm", "Erosion", "It was dismantled"],
        answer: 1,
      },
    ],
  },
  {
    passage:
      "Sourdough bread relies on a culture of wild yeast and lactic-acid bacteria. The bacteria slowly produce acids that break down gluten, giving the bread its tang and chewy crumb.",
    questions: [
      {
        q: "What two things live in a sourdough culture?",
        options: [
          "Yeast and salt",
          "Yeast and bacteria",
          "Bacteria and sugar",
          "Mould and yeast",
        ],
        answer: 1,
      },
      {
        q: "What gives sourdough its characteristic tang?",
        options: ["Added vinegar", "Long baking time", "Acids from bacteria", "Rye flour"],
        answer: 2,
      },
    ],
  },
  {
    passage:
      "Captain James Cook's third voyage left Plymouth in 1776, intending to find the Northwest Passage. Cook himself was killed in Hawai'i in 1779 before the expedition returned home.",
    questions: [
      {
        q: "What was Cook's third voyage looking for?",
        options: [
          "The South Pole",
          "The Northwest Passage",
          "Australia",
          "The source of the Nile",
        ],
        answer: 1,
      },
      {
        q: "Where was Cook killed?",
        options: ["Tahiti", "New Zealand", "Hawai'i", "Plymouth"],
        answer: 2,
      },
    ],
  },
  {
    passage:
      "Mycorrhizal fungi form symbiotic networks with the roots of most land plants. The fungi extend the effective root surface area, supplying water and minerals in exchange for sugars produced by photosynthesis.",
    questions: [
      {
        q: "What do mycorrhizal fungi receive from the plant?",
        options: ["Water", "Minerals", "Sugars", "Nitrogen"],
        answer: 2,
      },
      {
        q: "What benefit does the plant gain from the fungi?",
        options: [
          "Protection from herbivores",
          "Greater root surface area",
          "Faster germination",
          "Nitrogen fixation",
        ],
        answer: 1,
      },
    ],
  },
] as const;

const ITEM_PAYLOADS: Record<GameSlug, ReadonlyArray<Record<string, unknown>>> = {
  "synonym-match": SYNONYM_ITEMS.map((it) => ({ ...it, options: [...it.options] })),
  "mental-arith": MENTAL_ARITH_ITEMS.map((it) => ({ ...it })),
  "pairs-recall": PAIRS_RECALL_ITEMS,
  "reading-detail": READING_DETAIL_ITEMS.map((it) => ({
    ...it,
    questions: it.questions.map((q) => ({ ...q, options: [...q.options] })),
  })),
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

  const itemRows = gameRows.flatMap((game) => {
    const payloads = ITEM_PAYLOADS[game.slug as GameSlug];
    if (payloads.length !== 5) {
      throw new Error(
        `Seed bug: ${game.slug} must have exactly 5 items, got ${payloads.length}`,
      );
    }
    return payloads.map((payload, idx) => ({
      id: cuid(),
      gameId: game.id,
      payload,
      difficultyBand: idx + 1,
      version: 1,
      isPublished: true,
    }));
  });

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
