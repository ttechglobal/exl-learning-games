# Game Spec: Element Hunter (worked example)

This is the New Game Spec Template, filled out against Element Hunter's
real, already-shipped content — kept as a reference so anyone filling out
the blank template has a concrete example of what "done" looks like, not
just instructions.

---

## 0. Engine decision

- [x] Reuses an existing engine: `tile-match`

---

## 1. What the game is about

- **Slug**: `element-hunter`
- **Title**: Element Hunter
- **Subject**: `chemistry`
- **Topic ID**: `periodic-table` *(example — confirm against real DB value)*
- **Subtopic ID**: —
- **One-sentence pitch**: A clue describing a property appears; the player
  taps the element tile(s) on the board that match it before time runs out.
- **What concept does this reinforce?**: Reading and connecting an
  element's core identifying properties — atomic number, electron count,
  period, valence electrons, mass number, and group/family — to the
  element itself.
- **Why does the mechanic teach that concept well?**: Forces rapid,
  repeated recall under light time pressure rather than passive reading;
  each round is a fresh retrieval-practice rep of "given property X, which
  element is it?"

---

## 2. Content

**Engine: `tile-match`**

- **Element pool**: the first 36 elements (H through Kr, periods 1-4),
  each with symbol, name, atomic number, period, group/family, valence
  electron count, and mass number. See `engines/tile-match/elementData.ts`.
- **Clue types**:
  - `atomic_number` — "Atomic Number 6"
  - `electron_number` — "6 electrons" (same value as atomic number for a
    neutral atom, asked a different way)
  - `period` — "Period 2"
  - `valence` — "4 valence electrons"
  - `mass_number` — "Mass Number 12"
  - `group` — "nonmetal" / "noble gas" / etc.
- **Defaults before difficulty modifiers**: `tileCount: 6`,
  `sessionDurationSec: 60`.

---

## 3. Quick Concepts snapshot

| Card title | Body |
|---|---|
| How to Play | Read the clue. Tap the element that matches. That's it! |
| Atomic Number | This is just the element's number on the periodic table. "Atomic Number 6" always means Carbon. |
| Element Families | Elements in the same family act alike. Noble gases barely react. Metals react fast. |
| Valence Electrons | These are an atom's outer electrons. Sodium has 1. Chlorine has 7. |
| Stuck? Use a Hint | Tap Hint to learn the pattern. It won't give away the answer. |

*(Note: this card set predates the Period/Mass Number clue types added in
the difficulty-segregation update — adding matching cards for those is a
real, tracked follow-up; see the Build Log.)*

---

## 4. Difficulty levels

Session-based difficulty (not discrete levels) — what's actually different
per tier:

- **Easy**: `atomic_number` and `electron_number` clues only — both are
  "read the number straight off the tile," just asked two ways. 4 tiles,
  90-second session.
- **Medium**: adds `period` and `valence` — now requires knowing WHERE an
  element sits and how it bonds, not just reading a label. 6 tiles,
  60-second session.
- **Hard**: adds `mass_number` and `group` — mass number requires
  connecting atomic weight to identity (not shown as plainly as atomic
  number), and group requires real periodic-table knowledge. 9 tiles,
  40-second session.

---

## 5. Background illustration / environment

- **Desktop image path**: `/mascot/scene-element-hunter.png`
- **Mobile image path**: `/mascot/scene-element-hunter.png` (same file —
  no separate mobile crop produced yet)
- **Mood/setting description**: A laboratory shelf scene — scattered
  element samples/specimens, evoking "elements have scattered across the
  lab and need tracking down" (matches the Mission Briefing framing below).
- **Accent color**: `var(--eg-subject-chemistry)`

---

## 6. Card art + description

- **Card art path**: `/mascot/card-element-hunter.svg`
- **Card description**: *(current copy is stale post difficulty-fix — see
  Build Log item)* ~~"Race the clock to spot elements by atomic number,
  group, and valence electrons."~~ → needs to mention the full clue range
  now, or stay intentionally general since the clue mix now varies by
  difficulty.

---

## 7. Mission Briefing flavor line

> "Welcome, Scientist. Elements have scattered across the lab shelves.
> Track down the right ones before the timer runs out."

---

## 8. Subject metadata

N/A — chemistry already exists in `subjects.ts`.

---

## 9. Missions

*(Example shape — confirm exact stored values against the live DB row,
which this session doesn't have direct access to.)*

- **Mission key**: `element-hunter-main`
- **Title**: Element Hunter
- **Difficulty**: session-based (player-chosen at play time, not a fixed
  mission difficulty — see Section 4)
- **Sequence index**: `0`
- **XP reward**: per session score, not a flat mission reward (see
  `TileMatchOutcome.finalScore`)
- **Learning goal**: "Identify elements by their core properties."
- **Estimated minutes**: ~2 (one timed session)

---

## 10. Mission Objectives checklist

Inherited from the `tile-match` engine default
(`lib/content/missionObjectives.ts`):
- "Find and match the correct pairs of tiles."
- "Clear the whole board."
- "Earn bonus XP for fewer wrong attempts."

*(Note: this wording is actually stale/inaccurate for Element Hunter's real
mechanic — it describes a pairs/board-clearing game, not a timed
clue-and-tap session. Real, tracked follow-up; see the Build Log.)*

---

## 11. Open questions / unresolved decisions

- Quick Concepts cards don't yet cover the Period or Mass Number clue
  types added in the difficulty-segregation update.
- Card description (Section 6) and engine-level Mission Objectives
  (Section 10) both have wording that's drifted from what the game
  actually does and should be refreshed.
