/**
 * lib/content/subjects.ts
 *
 * Subject metadata (display name, emoji, accent color, tint) — was
 * duplicated three times with the same data in different shapes:
 * HomePage.tsx's `SUBJECTS` (an array), WorldsClient.tsx's `SUBJECT_META`
 * (a record), and now the new /worlds/[subject] page would have needed a
 * third copy. Consolidated here as the single source of truth; a new
 * subject (e.g. History) gets added once, not three times with the risk
 * of one copy drifting from the others.
 *
 * Kept as a Record (not an array) since most call sites look up "give me
 * chemistry's metadata" by key, not "iterate all subjects in order" — for
 * the rare place that needs an ordered list (e.g. the homepage's subject
 * rail), use Object.entries(SUBJECT_META) and the iteration order matches
 * the insertion order below.
 */

export interface SubjectMeta {
  name: string;
  emoji: string;
  color: string;
  tint: string;
}

export const SUBJECT_META: Record<string, SubjectMeta> = {
  chemistry: { name: "Chemistry", emoji: "\u{1F9EA}", color: "var(--eg-subject-chemistry)", tint: "color-mix(in srgb, var(--eg-subject-chemistry) 14%, white)" },
  mathematics: { name: "Mathematics", emoji: "\u{1F4D0}", color: "var(--eg-subject-mathematics)", tint: "color-mix(in srgb, var(--eg-subject-mathematics) 14%, white)" },
  physics: { name: "Physics", emoji: "\u26A1", color: "var(--eg-subject-physics)", tint: "color-mix(in srgb, var(--eg-subject-physics) 14%, white)" },
  biology: { name: "Biology", emoji: "\u{1F9EC}", color: "var(--eg-subject-biology)", tint: "color-mix(in srgb, var(--eg-subject-biology) 14%, white)" }
};

/** Fallback for any subject key not yet in SUBJECT_META — generates a
 *  reasonable label/color from the key itself rather than crashing or
 *  showing nothing, so a newly-seeded subject doesn't need a code change
 *  here before it can render anywhere. */
export function subjectMeta(key: string): SubjectMeta {
  return (
    SUBJECT_META[key] ?? {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      emoji: "\u{1F4D6}",
      color: "var(--eg-brand)",
      tint: "var(--eg-brand-tint)"
    }
  );
}