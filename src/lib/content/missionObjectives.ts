/**
 * lib/content/missionObjectives.ts
 *
 * Mission briefings — shown before gameplay begins.
 *
 * TONE: Game-mission style, but written for secondary school students
 * (ages 13–18). Short sentences, simple words. It should feel exciting,
 * not like a textbook. The chemistry/science learning goal is in there
 * but stated naturally, not as a lesson header.
 *
 * A 15-year-old should be able to read the brief in 5 seconds and
 * immediately know: "okay, I get what this game is and what I need to do."
 */

export interface MissionObjectives {
  /** 2–3 short sentences. Game-world framing, simple language.
   *  Learning goal is woven in, not announced. */
  brief: string;
  /** Short ✓ lines — what the player will DO. Max ~8 words each. */
  items: string[];
}

const OBJECTIVES_BY_SLUG: Record<string, MissionObjectives> = {
  "atom-forge": {
    brief:
      "Atoms join together to form compounds — like salt, water, and the materials all around you.\n\nYour job: bond the right atoms together to build each compound before time runs out.",
    items: [
      "Drag two atoms together to bond them.",
      "Build the compound shown in the mission.",
      "Ionic bonds give electrons. Covalent bonds share them.",
      "Beat the clock — forge as many as you can."
    ]
  },
  "carbon-builder": {
    brief:
      "Carbon is the building block of all living things. Every carbon atom bonds exactly 4 times — no more, no less.\n\nBuild the molecule shown. Place the atoms. Connect the bonds. Simple.",
    items: [
      "Place each atom into its slot.",
      "Carbon bonds exactly 4 times — don't go over.",
      "Tap a bond line to set it as single, double, or triple.",
      "Hit Submit when your molecule matches the target."
    ]
  },
  "element-hunter": {
    brief:
      "Every element on the Periodic Table has its own atomic number, electrons, and position. You need to know them fast.\n\nFind the right element from the clue before the timer runs out.",
    items: [
      "Read the clue and tap the correct element.",
      "Clear the board before time runs out.",
      "Clues get harder — atomic number, valence, group, and more.",
      "Use a hint if you're stuck — it's free."
    ]
  },
  "build-the-atom": {
    brief:
      "Every atom is made of protons, neutrons, and electrons. The number of each one tells you exactly what element it is.\n\nBuild the exact atom shown. Get all three numbers right.",
    items: [
      "Add the right number of protons.",
      "Match the neutron count for the correct isotope.",
      "Balance the electrons to make it neutral.",
      "Submit only when all three counts match."
    ]
  },
  "mirror-lab": {
    brief:
      "A new experiment has arrived at the lab. The research team is waiting.\n\nConfigure the optical system — choose your mirror, position the object — and produce the required image before the deadline.",
    items: [
      "Drag the object arrow left or right to move it.",
      "Switch between concave and convex mirrors as needed.",
      "Watch the image update live as you experiment.",
      "Press Run Experiment when you think you have it."
    ]
  }
};

const OBJECTIVES_BY_ENGINE: Record<string, MissionObjectives> = {
  "bond-match": {
    brief:
      "Atoms join together to form the compounds that make up everything around us.\n\nBond the right pairs of atoms together to build each compound before time runs out.",
    items: [
      "Drag two atoms together to bond them.",
      "Build the compound the mission shows.",
      "Race the clock — forge as many as you can."
    ]
  },
  "particle-assembly": {
    brief:
      "Every element is defined by the particles inside its atom. Protons, neutrons, electrons — get the numbers right.\n\nBuild the exact atom shown.",
    items: [
      "Add the right protons, neutrons, and electrons.",
      "The whole structure must be correct to score.",
      "Double-check all three before you submit."
    ]
  },
  "tile-match": {
    brief:
      "The Periodic Table has 118 elements. You need to know them fast.\n\nMatch each clue to the right element tile before time runs out.",
    items: [
      "Read the clue and tap the right element.",
      "Clear the board before time runs out.",
      "Fewer wrong taps = more XP."
    ]
  },
  "molecule-builder": {
    brief:
      "Molecules are built by connecting atoms with bonds. Every atom has a limit — go over it and the molecule breaks.\n\nBuild the target molecule. Get the structure right.",
    items: [
      "Place atoms into their slots.",
      "Each atom has a max bond count — stay within it.",
      "Tap a bond line to set it as single, double, or triple.",
      "Submit when your molecule matches the target."
    ]
  }
};

const FALLBACK_OBJECTIVES: MissionObjectives = {
  brief: "Your mission is ready. Complete the challenge to earn XP.",
  items: [
    "Follow the on-screen instructions.",
    "Earn XP for a successful finish."
  ]
};

export function resolveMissionObjectives(
  engineType: string,
  gameSlug?: string,
  missionPayload?: Record<string, unknown>
): MissionObjectives {
  const bySlug = gameSlug ? OBJECTIVES_BY_SLUG[gameSlug] : undefined;
  const base = bySlug ?? OBJECTIVES_BY_ENGINE[engineType] ?? FALLBACK_OBJECTIVES;
  const override = missionPayload?.objectivesOverride as string[] | undefined;
  if (!override) return base;
  return { ...base, items: override };
}
