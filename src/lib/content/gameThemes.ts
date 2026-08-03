/**
 * lib/content/gameThemes.ts
 *
 * Single source of truth for every game's visual identity.
 *
 * REPLACES:
 *   gameCardMeta.ts     → GAME_CARD_ART + GAME_CARD_DESC
 *   gameEnvironments.ts → GAME_ENVIRONMENT_IMAGES + resolveGameEnvironmentImages
 *                         + resolveGameThemeGradient
 *
 * TO ADD A NEW GAME — edit only this file:
 *   1. Add an entry to GAME_THEMES keyed on the game slug
 *   2. Create public/mascot/card-{slug}.svg (hand-coded SVG, 280×200)
 *   3. Optionally add public/backgrounds/{slug}.svg (flat world background)
 *
 * PALETTE GUIDE:
 *   Mathematics : forest green #0a1a0e  · gold #c9a227    · emerald #3ecf8e
 *   Chemistry   : deep teal   #041418  · cyan #00d4ff    · white
 *   Physics     : deep navy   #080820  · blue #4488ff    · white
 *   Biology     : deep jungle #081a06  · lime #7ecf3e    · white
 */

export interface GameEnvironment {
  desktop: string;
  mobile: string;
}

export interface GameTheme {
  /** SVG card art path in /public/mascot/ — omit until art is ready */
  cardArt?: string;
  /** One-sentence description shown on the game shelf */
  description: string;
  /**
   * Full CSS gradient for the pre-game screens
   * (level select, mission briefing, difficulty, objectives).
   * Should feel like entering the game's world.
   */
  preGameGradient: string;
  /**
   * Gradient for in-game GameplayShell fallback
   * (shown when no environment illustration is loaded).
   */
  gameGradient: string;
  /**
   * Primary accent colour — highlights, active borders, mascot speech.
   * Use the game's "gold": the colour that means "this matters".
   */
  accent: string;
  /** Environment illustration pair — optional */
  environment?: GameEnvironment;
}

export const GAME_THEMES: Record<string, GameTheme> = {

  // ── Mathematics ─────────────────────────────────────────────────────────

  /**
   * Change of Subject Formula
   * World: a glowing maths notebook — drag and drop operations across
   * the equals sign to isolate the target variable. Notebook paper
   * aesthetic with gold operation tiles, teal drop zones, warm cream paper.
   * Palette: warm cream → teal → gold
   */
  "change-of-subject-formula": {
    cardArt: "/mascot/card-change-of-subject.svg",
    description: "Drag operation tiles across the equals sign to isolate any variable — master the one skill that unlocks every formula in maths and science.",
    preGameGradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)",
    gameGradient:    "linear-gradient(160deg, #fffdf5 0%, #fef9e7 100%)",
    accent: "#c9a227",
  },

  /**
   * Nova the Explorer (legacy slug — kept for any existing DB rows)
   */
  "nova-explorer": {
    cardArt: "/mascot/card-change-of-subject.svg",
    description: "Drag operation tiles across the equals sign to isolate any variable — master the one skill that unlocks every formula in maths and science.",
    preGameGradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)",
    gameGradient:    "linear-gradient(160deg, #fffdf5 0%, #fef9e7 100%)",
    accent: "#c9a227",
  },

  /**
   * Alias: plain slug variant (covers any DB row seeded with this slug)
   */
  "change-of-subject": {
    cardArt: "/mascot/card-change-of-subject.svg",
    description: "Drag operation tiles across the equals sign to isolate any variable — master the one skill that unlocks every formula in maths and science.",
    preGameGradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)",
    gameGradient:    "linear-gradient(160deg, #fffdf5 0%, #fef9e7 100%)",
    accent: "#c9a227",
  },

  /**
   * Simultaneous Equations Detective
   * World: noir detective office, pinboard case files, chalkboard equations,
   * lamp casting warm light on a dark desk.
   * Palette: deep navy → detective amber → warm white
   */
  "simultaneous-equations-detective": {
    cardArt: "/mascot/card-simultaneous-equations.svg",
    description: "Crack mathematical cases by choosing the right sequence of elimination steps to uncover hidden values.",
    preGameGradient: "linear-gradient(160deg, #0b1330 0%, #0e1a2e 55%, #0a1f3a 100%)",
    gameGradient:    "linear-gradient(160deg, #0b1330 0%, #0e1a2e 55%, #0a1f3a 100%)",
    accent: "#f59e0b",
    environment: {
      desktop: "/illustrations/simultaneous-equations-detective-desktop.png",
      mobile:  "/illustrations/simultaneous-equations-detective-mobile.png",
    },
  },

  // ── Chemistry ───────────────────────────────────────────────────────────

  /**
   * Atom Forge
   * World: industrial reactor core, glowing plasma containment rings,
   * atom models floating in magnetic suspension fields, control panels.
   * Palette: deep teal → electric cyan → white
   */
  "atom-forge": {
    cardArt: "/mascot/card-atom-forge.svg",
    description: "Bond atoms together and repair the machine that builds the world's materials.",
    preGameGradient: "linear-gradient(160deg, #041418 0%, #082028 50%, #041018 100%)",
    gameGradient:    "linear-gradient(160deg, #031012 0%, #061820 100%)",
    accent: "#00d4ff",
    environment: {
      desktop: "/illustrations/atom-forge-desktop.png",
      mobile:  "/illustrations/atom-forge-mobile.png",
    },
  },

  /**
   * Element Hunter
   * World: giant periodic table hall, glowing element tiles on illuminated
   * panels, a hunter with a spotlight searching for specific elements.
   * Palette: deep blue-purple → electric violet → white
   */
  "element-hunter": {
    cardArt: "/mascot/card-element-hunter.svg",
    description: "Race the clock to spot elements by atomic number, group, and valence electrons.",
    preGameGradient: "linear-gradient(160deg, #0d0820 0%, #150e30 50%, #0a0618 100%)",
    gameGradient:    "linear-gradient(160deg, #0a0618 0%, #120c28 100%)",
    accent: "#a855f7",
    environment: {
      desktop: "/illustrations/element-hunter-desktop.png",
      mobile:  "/illustrations/element-hunter-mobile.png",
    },
  },

  /**
   * Build the Atom
   * World: subatomic particle lab, nucleus being assembled at the centre,
   * electron shells orbiting in neon rings against a deep cosmic background.
   * Palette: deep navy → electric blue → nucleus gold
   */
  "build-the-atom": {
    cardArt: "/mascot/card-build-the-atom.svg",
    description: "Add protons, neutrons, and electrons to build the exact atom or isotope you're given.",
    preGameGradient: "linear-gradient(160deg, #080c28 0%, #0e1240 50%, #060820 100%)",
    gameGradient:    "linear-gradient(160deg, #060820 0%, #0c1038 100%)",
    accent: "#4488ff",
    environment: {
      desktop: "/illustrations/build-the-atom-desktop.png",
      mobile:  "/illustrations/build-the-atom-mobile.png",
    },
  },

  /**
   * Carbon Builder
   * World: molecular construction yard, giant carbon scaffolding being
   * assembled, atoms clicking into bonds with visible energy lines.
   * Palette: deep charcoal → warm orange → white
   */
  "carbon-builder": {
    cardArt: "/mascot/card-carbon-builder.svg",
    description: "Drag atoms together and build real molecules — one bond at a time, within carbon's strict 4-bond limit.",
    preGameGradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1008 50%, #0a0800 100%)",
    gameGradient:    "linear-gradient(160deg, #0a0800 0%, #141008 100%)",
    accent: "#f97316",
    environment: {
      desktop: "/illustrations/carbon-builder-desktop.png",
      mobile:  "/illustrations/carbon-builder-mobile.png",
    },
  },

  /**
   * Matter Lab
   * World: a sealed temperature-control chamber, glowing particle dots
   * shifting between blue (solid), cyan (liquid), and amber (gas) as the
   * student manipulates a heat slider. Deep space-lab atmosphere.
   * Palette: deep space-black → electric cyan → warm amber
   */
  "matter-lab": {
    description: "Control the heat and watch particles change state — drag the temperature slider and name what you see happening.",
    preGameGradient: "linear-gradient(160deg, #03080f 0%, #071828 50%, #040e1a 100%)",
    gameGradient:    "linear-gradient(160deg, #03080f 0%, #0a1a2e 100%)",
    accent: "#38c0f0",
  },

  // ── Physics ─────────────────────────────────────────────────────────────

  /**
   * Mirror Lab
   * World: optics research lab, curved mirrors on precision stands,
   * light rays bending and converging, measurement instruments.
   * Palette: deep cool grey → warm lens yellow → white
   */
  "mirror-lab": {
    description: "Perform real optics experiments. Move the object, switch mirrors, and observe how the image changes — then run the experiment.",
    preGameGradient: "linear-gradient(160deg, #080c14 0%, #101828 50%, #060a10 100%)",
    gameGradient:    "linear-gradient(160deg, #060a10 0%, #0e1626 100%)",
    accent: "#fbbf24",
    environment: {
      desktop: "/illustrations/mirror-lab-desktop.png",
      mobile:  "/illustrations/mirror-lab-mobile.png",
    },
  },


  "whack-a-mole": {
  cardArt: "/mascot/card-whack-a-mole.svg",
  description: "Tap critters across 5 frantic waves. Avoid bombs, catch golden moles, build combos.",
  preGameGradient: "linear-gradient(160deg, #1a2744 0%, #0f172a 60%, #0a1020 100%)",
  gameGradient:    "linear-gradient(160deg, #1a2744 0%, #0f172a 100%)",
  accent: "#f59e0b",
},
 
/**
 * Element Crush (coming soon)
 * Slug: "element-crush"
 */
"element-crush": {
  description: "Match element tiles to clear the board — Candy Crush with a chemistry twist.",
  preGameGradient: "linear-gradient(160deg, #041418 0%, #082028 50%, #041018 100%)",
  gameGradient:    "linear-gradient(160deg, #031012 0%, #061820 100%)",
  accent: "#00d4ff",
},
 
/**
 * Atomic Structure
 * World: subatomic exploration — peel back layers of matter to reveal
 * the atom's internal structure. Tap to discover the nucleus and electrons.
 * Palette: deep space-black → electric cyan → nucleus orange
 */
"atomic-structure": {
  description: "Peel back the layers of matter and discover what's really inside — tap through to reveal the atom's nucleus and orbiting electrons.",
  preGameGradient: "linear-gradient(160deg, #030a14 0%, #061828 50%, #041020 100%)",
  gameGradient:    "linear-gradient(160deg, #030a14 0%, #0a1a2e 100%)",
  accent: "#00d4ff",
},

/**
 * Symbol Drop (coming soon)
 * Slug: "symbol-drop"
 */
"symbol-drop": {
  description: "Catch falling chemical symbols before they hit the ground.",
  preGameGradient: "linear-gradient(160deg, #080c28 0%, #0e1240 50%, #060820 100%)",
  gameGradient:    "linear-gradient(160deg, #060820 0%, #0c1038 100%)",
  accent: "#4488ff",
},
};

// ── Subject-level themes (used when no specific game slug matches) ──────────

const SUBJECT_THEMES: Record<string, GameTheme> = {
  chemistry: {
    description: "",
    preGameGradient: "linear-gradient(160deg, #041418 0%, #061e24 50%, #083028 100%)",
    gameGradient:    "linear-gradient(160deg, #041418 0%, #061e24 100%)",
    accent: "#00d4ff",
  },
  physics: {
    description: "",
    preGameGradient: "linear-gradient(160deg, #080820 0%, #0c1040 50%, #0a0c30 100%)",
    gameGradient:    "linear-gradient(160deg, #080820 0%, #0c1040 100%)",
    accent: "#4488ff",
  },
  biology: {
    description: "",
    preGameGradient: "linear-gradient(160deg, #081a06 0%, #0f2a08 50%, #0a2006 100%)",
    gameGradient:    "linear-gradient(160deg, #081a06 0%, #0f2a08 100%)",
    accent: "#7ecf3e",
  },
  mathematics: {
    description: "",
    preGameGradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)",
    gameGradient:    "linear-gradient(160deg, #fffdf5 0%, #fef9e7 100%)",
    accent: "#c9a227",
  },
};

// ── Fallback ───────────────────────────────────────────────────────────────

const FALLBACK_THEME: GameTheme = {
  description: "",
  preGameGradient: "linear-gradient(160deg, #0b1330 0%, #0e1a2e 55%, #0a1f3a 100%)",
  gameGradient:    "linear-gradient(160deg, #0b1330 0%, #0e1a2e 55%, #0a1f3a 100%)",
  accent: "var(--eg-brand)",
};

// ── Accessors ──────────────────────────────────────────────────────────────

export function getGameTheme(slug: string, subject?: string): GameTheme {
  if (GAME_THEMES[slug]) return GAME_THEMES[slug];
  if (subject && SUBJECT_THEMES[subject]) return SUBJECT_THEMES[subject];
  // Try to detect subject from slug prefix (e.g. "chemistry-matter")
  const subjectFromSlug = Object.keys(SUBJECT_THEMES).find(s => slug.startsWith(s + "-"));
  if (subjectFromSlug) return SUBJECT_THEMES[subjectFromSlug];
  return FALLBACK_THEME;
}

export function getSubjectTheme(subject: string): GameTheme {
  return SUBJECT_THEMES[subject] ?? FALLBACK_THEME;
}

export function getGameCardArt(slug: string): string | undefined {
  return GAME_THEMES[slug]?.cardArt;
}

export function getGameDescription(slug: string): string {
  return GAME_THEMES[slug]?.description ?? "";
}

export function getGamePreGameGradient(slug: string): string {
  return getGameTheme(slug).preGameGradient;
}

export function getGameGradient(slug: string): string {
  return getGameTheme(slug).gameGradient;
}

export function getGameAccent(slug: string): string {
  return getGameTheme(slug).accent;
}

export function getGameEnvironment(slug: string): GameEnvironment | undefined {
  return GAME_THEMES[slug]?.environment;
}