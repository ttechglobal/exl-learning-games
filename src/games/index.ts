/**
 * src/games/index.ts
 *
 * Central registry for all standalone games.
 *
 * A "game" here is different from a "learning engine" (in src/engines/).
 * Engines are curriculum-tied: they have missions, topics, mastery scores,
 * and live under a DB-backed game row. Games in this registry are:
 *
 *   1. Standalone fun / arcade experiences (Whack-a-Mole, future Candy Crush-like)
 *   2. May be launched from the Worlds arcade strip without a curriculum anchor
 *   3. Still award XP and are trackable, but they don't require a game row in the DB
 *
 * HOW TO ADD A NEW GAME:
 *   1. Create src/games/{slug}/ folder
 *   2. Build {GameName}Engine.tsx + {GameName}Engine.module.css inside it
 *   3. Add an entry to STANDALONE_GAMES below
 *   4. Add the slug to ARCADE_SLUGS in WorldsClient.tsx so it shows in the arcade strip
 *   5. Add an entry to GAME_THEMES in lib/content/gameThemes.ts for card art + description
 *
 * The slug used here MUST match:
 *   - The key in GAME_THEMES
 *   - The slug in ARCADE_SLUGS (WorldsClient.tsx)
 *   - The route you create at /play/{slug} if you want a dedicated page
 */

export interface StandaloneGame {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  /** Subjects this game works with (empty = any subject) */
  subjects: string[];
  /** Whether the game has been extracted from an engine and is fully standalone */
  isReady: boolean;
  /** Where the engine component lives */
  componentPath: string;
}

export const STANDALONE_GAMES: StandaloneGame[] = [
  {
    slug: "whack-a-mole",
    title: "Whack-a-Mole",
    description: "Tap the critters as fast as you can across 5 increasingly frantic waves. Avoid bombs, catch golden moles, build combos.",
    emoji: "🐹",
    subjects: [], // works with any subject
    isReady: true,
    componentPath: "@/games/whack-a-mole/WhackAMoleEngine",
  },
  // ── Coming soon ────────────────────────────────────────────────────────────
  // Add entries here as new arcade games are built. Set isReady: false
  // to show the "Coming Soon" placeholder in the arcade strip.
  {
    slug: "element-crush",
    title: "Element Crush",
    description: "Match element tiles to clear the board — a Candy Crush-style game with a chemistry twist.",
    emoji: "🍬",
    subjects: ["chemistry"],
    isReady: false,
    componentPath: "@/games/element-crush/ElementCrushEngine",
  },
  {
    slug: "symbol-drop",
    title: "Symbol Drop",
    description: "Catch the correct chemical symbols as they fall. Miss one and you lose a life.",
    emoji: "🎯",
    subjects: ["chemistry", "physics"],
    isReady: false,
    componentPath: "@/games/symbol-drop/SymbolDropEngine",
  },
];

/** Look up a standalone game by slug */
export function getStandaloneGame(slug: string): StandaloneGame | undefined {
  return STANDALONE_GAMES.find(g => g.slug === slug);
}

/** All slugs that are ready to play */
export const READY_GAME_SLUGS = new Set(
  STANDALONE_GAMES.filter(g => g.isReady).map(g => g.slug)
);

/** All standalone game slugs (ready + coming soon) — used for the arcade strip */
export const ALL_ARCADE_SLUGS = new Set(STANDALONE_GAMES.map(g => g.slug));