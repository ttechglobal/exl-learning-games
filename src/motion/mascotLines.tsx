/**
 * motion/mascotLines.ts
 *
 * Short lines of dialogue the mascot "says" when it pops up after a
 * correct or incorrect answer. Per direct feedback: the mascot should
 * react to correctness in different ways each time, not the same single
 * silent pose every round — and on a miss it should always read as
 * encouraging, never as a scold. Every CORRECT line is genuine praise;
 * every INCORRECT line is a warm "try again" nudge, never anything that
 * sounds like punishment or judgment (no "Wrong!", no "No.") — this is a
 * deliberate content rule, not just a style preference, per the
 * platform's "no punishment, only guidance" principle (see Mascot.tsx's
 * own header comment for the same rule applied to the art).
 *
 * Picked at random each time a pose fires, with a "don't repeat the line
 * that just played" guard so two correct answers in a row don't show the
 * identical caption — small thing, but it's what makes the mascot feel
 * alive across a whole session instead of a fixed two-state lookup.
 */

export const MASCOT_CORRECT_LINES = [
  "Nice work!",
  "You've got it!",
  "Exactly right!",
  "Boom — correct!",
  "That's the one!",
  "Great catch!",
  "You're on fire!",
  "Nailed it!",
  "Smart thinking!",
  "Yes! Keep going!"
];

export const MASCOT_INCORRECT_LINES = [
  "So close — try again!",
  "Not quite, but you'll get it!",
  "Nice try — give it another shot!",
  "Almost! Take another look.",
  "Keep going, you've got this!",
  "Good guess — try one more!",
  "That's okay — let's try again!",
  "You're learning — go again!"
];

export const MASCOT_CELEBRATE_LINES = [
  "You crushed it!",
  "Mission complete — amazing work!",
  "Look at you go!",
  "That's how it's done!",
  "Fantastic job out there!",
  "You should be proud of that!"
];

type MascotLineKind = "correct" | "incorrect" | "celebrate";

const LINE_SETS: Record<MascotLineKind, string[]> = {
  correct: MASCOT_CORRECT_LINES,
  incorrect: MASCOT_INCORRECT_LINES,
  celebrate: MASCOT_CELEBRATE_LINES
};

/**
 * Returns a random line for the given kind, avoiding `previous` (the
 * line that was just shown) when the set has more than one option —
 * callers pass their current state value in and store the result back,
 * so consecutive pops don't repeat the same caption.
 */
export function pickMascotLine(kind: MascotLineKind, previous?: string | null): string {
  const lines = LINE_SETS[kind];
  if (lines.length <= 1) return lines[0];
  let candidate = lines[Math.floor(Math.random() * lines.length)];
  if (candidate === previous) {
    const idx = lines.indexOf(candidate);
    candidate = lines[(idx + 1) % lines.length];
  }
  return candidate;
}