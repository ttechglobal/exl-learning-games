# Element Hunter — Game Design Spec (filled from game-design-template.md)

## 1. Identity
- **Title:** Element Hunter
- **Subject:** Chemistry
- **Fantasy:** You're a fast-thinking element scout, racing the clock to spot elements by their properties.

## 2. Environment
- Bright arcade grid, energetic/fast mood. Reuses `hunter-backdrop.svg` (already built).

## 3. Core Mechanic
- Player taps the tile matching the current clue.
- Moment of truth: the tap, checked against the clue's match rule (not exact-symbol match — see the isMatch fix from the prototype build).
- New engine: `tile-match`. Shape: a clue plus a grid of N tiles, exactly one or more of which satisfies the clue; tap-to-resolve, immediate next round. Distinct from particle-assembly (no live counters) and the bonding shape (no drag/proximity).

## 4. Progression — NEW, this is the fix
Three tiers, unlocked in order within one session (not separate level-select menus — this game's identity is fast continuous play, so progression ramps WITHIN the timer):

- Tier 1 (first ~8 correct): atomic-number clues only.
- Tier 2 (next stretch): introduces group/property clues mixed with atomic number.
- Tier 3 (remainder): introduces valence-electron clues, all three types mixed.

Ramp is performance-gated, not just time-gated: advance after N correct answers at the current tier OR a time threshold, whichever comes first. This is a simple local rule, not the full adaptivePolicy placeholder from the architecture doc.

- Timed: yes, 60s default. At zero: hard stop, go to results.

## 5. Content Scope — EXPANDED, this is the fix
Extend from 18 to the first 36 elements (periods 1-4, through Krypton). Each element needs: symbol, name, atomic number, group label, valence count, accent color.

## 6. Feedback Rules
- Success: burst + score pop + streak counter (as built).
- Failure: shake + mascot-encourage + small time penalty (2s, as built).
- Hints — NEW: a tappable hint affordance appears after one wrong answer on the current clue. Tapping it costs a bigger time penalty (3s) and eliminates one incorrect tile, narrowing the field rather than revealing the answer outright.

## 7. Session Bookends
- Before: Concept Snapshot, standard component. Content: "Elements are grouped by shared properties. Atomic number = proton count. Valence electrons are in the outermost shell."
- After: standard Reflection screen. No bespoke end-of-session review for this game specifically — that is a cross-game feature being designed separately.

## 8. Scoring & Competition
- High score: yes, score and best streak.
- Leaderboard: feeds the cross-game XP leaderboard once built.
