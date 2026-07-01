/**
 * lib/content/gameTopics.ts
 *
 * Topic taxonomy — per direct feedback: games should be tagged with a
 * topic so players can filter within a subject ("just show me Periodic
 * Table games" / "just show me Chemical Bonding games") and each card
 * clearly communicates what it's actually about.
 *
 * Every game's `topic_id` column (GameRow.topic_id) maps to a key here.
 * The filter tab UI on /worlds reads this map to build its tab list for
 * each subject — add a new entry here and the filter tab appears
 * automatically on the next deploy, no component changes needed.
 *
 * ARCHITECTURE NOTE: `topic_id` already exists on every game row in the
 * DB (see types/db.ts GameRow.topic_id) and is already populated in
 * content/games/chemistry/*.json — this file gives those bare slugs
 * human-readable labels and parent-subject relationships. The slugs are
 * treated as stable identifiers (same role as game slugs), so don't
 * rename them once seeded; add new ones freely.
 *
 * Current topics (extend as the game library grows):
 *   periodic-table    → Periodic Table   (Chemistry)
 *   atomic-structure  → Atomic Structure (Chemistry)
 *   chemical-bonding  → Chemical Bonding (Chemistry)
 *   hydrocarbons      → Hydrocarbons     (Chemistry)
 *   molecular-bonding → Molecular Bonding (Chemistry, alias used by
 *                        carbon-builder's DB row — maps to same label)
 */

export interface GameTopic {
  id: string;
  label: string;
  /** The subject this topic belongs to — used to decide which subject
   *  section's filter tab list to include it in. */
  subject: string;
}

const TOPIC_LIST: GameTopic[] = [
  { id: "periodic-table",    label: "Periodic Table",    subject: "chemistry" },
  { id: "atomic-structure",  label: "Atomic Structure",  subject: "chemistry" },
  { id: "chemical-bonding",  label: "Chemical Bonding",  subject: "chemistry" },
  { id: "molecular-bonding", label: "Molecular Bonding", subject: "chemistry" },
  { id: "hydrocarbons",      label: "Hydrocarbons",      subject: "chemistry" },
  { id: "forces",            label: "Forces",             subject: "physics" },
  { id: "waves",             label: "Waves",              subject: "physics" },
  { id: "electricity",       label: "Electricity",        subject: "physics" },
  { id: "algebra",           label: "Algebra",            subject: "mathematics" },
  { id: "geometry",          label: "Geometry",           subject: "mathematics" },
  { id: "statistics",        label: "Statistics",         subject: "mathematics" },
  { id: "cells",             label: "Cells",              subject: "biology" },
  { id: "genetics",          label: "Genetics",           subject: "biology" },
  { id: "ecology",           label: "Ecology",            subject: "biology" }
];

/** Full map for O(1) lookup — the label shown on game cards and filter
 *  tabs. Returns the bare slug as a fallback so unknown topic IDs don't
 *  silently break anything. */
export const TOPIC_MAP: Record<string, GameTopic> = Object.fromEntries(
  TOPIC_LIST.map((t) => [t.id, t])
);

/** All topics for a given subject — used by the filter-tab component to
 *  build its tab list. Only topics with at least one matching game are
 *  actually shown (WorldsClient filters the list by what's in the data
 *  before rendering); this just provides the full ordered catalogue. */
export function topicsForSubject(subject: string): GameTopic[] {
  return TOPIC_LIST.filter((t) => t.subject === subject);
}

/** Human-readable label for a topic id — the chip text on a game card. */
export function topicLabel(topicId: string): string {
  return TOPIC_MAP[topicId]?.label ?? topicId.replace(/-/g, " ");
}
