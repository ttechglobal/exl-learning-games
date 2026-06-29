# New Game Spec Template

**Purpose:** fill this out once per new game, before any code or content gets
written. It's the single source of truth that everyone (design, content,
engineering) works from, and it's the checklist that makes sure nothing gets
forgotten — every section below maps to something the platform actually
requires to render and run a game, not generic boilerplate.

Copy this file, rename it to the game's slug (e.g. `acid-base-blaster.md`),
and fill in every section. Sections marked **(Required)** must be filled in
before the game can be built; sections marked **(Optional — has fallback)**
can be skipped at first, and the platform will fall back to a generic
default — but every shipped game should circle back and fill these in before
it's actually promoted/featured anywhere.

---

## 0. Engine decision (Required)

Before anything else: **does this game reuse an existing engine, or does it
need a new one?**

An engine is the actual gameplay mechanic — the rules for what's on screen,
how the player interacts, how a round resolves. Three exist today:

| Engine | Mechanic | Example |
|---|---|---|
| `tile-match` | A clue appears; player taps the tile(s) that satisfy it from a grid; session is timed | Element Hunter |
| `bond-match` | Player drags/matches atom pairs to form compounds, either as discrete levels or a timed "factory" mode | Atom Forge |
| `particle-assembly` | Player adds discrete countable units (protons, neutrons, etc.) toward a target composition, checked on submit | Build the Atom |

**If one of these fits** (even loosely — e.g. "tap the thing that matches a
clue" fits tile-match even if the clue domain is biology, not chemistry),
use it. Reusing an engine means this spec is ALL you need — no new code, just
content.

**If none fit**, this is a new-engine project, which is a bigger lift (new
schema, new round logic, new component, one line in the engine registry).
Fill out this spec anyway for the content side, but flag clearly in Section 1
that a new engine is needed, and treat the mechanic description in Section 1
as the brief an engineer would build the engine from.

- [ ] Reuses an existing engine: ______________________
- [ ] Needs a new engine (describe the mechanic fully in Section 1)

---

## 1. What the game is about (Required)

- **Slug** (lowercase-kebab-case, becomes the URL and every content lookup
  key, e.g. `element-hunter`): ______________________
- **Title** (shown to players): ______________________
- **Subject** (`chemistry` / `mathematics` / `physics` / `biology`, or a new
  one — see Section 8 if new): ______________________
- **Topic ID** (slug, e.g. `chemical-bonding`): ______________________
- **Subtopic ID** (optional, slug): ______________________
- **One-sentence pitch** — what does the player actually do?
  ______________________
- **What concept does this reinforce?** (the actual classroom learning
  goal — be specific, not "chemistry basics")
  ______________________
- **Why does the chosen engine/mechanic teach that concept well?** (this is
  the thing reviewers should be able to sanity-check before content gets
  written — if the mechanic and the concept don't actually connect, that's
  worth catching here, not after building)
  ______________________

---

## 2. Content (Required)

This is the actual question/challenge data — shape depends entirely on which
engine you picked in Section 0. Fill in whichever block matches.

### If `tile-match`:
- **Element/item pool**: list every item the game can draw from (symbols,
  names, and whatever properties the clue types need — see
  `engines/tile-match/elementData.ts` for the shape: number, period, group,
  valence, mass, etc. for chemistry; a non-chemistry tile-match game needs
  its own equivalent dataset with whatever properties ITS clue types check).
- **Clue types**: what properties can a clue test? (e.g. atomic number,
  valence, period, mass number for Element Hunter — list the equivalent for
  this game)
- **Tile count, session length**: defaults, before difficulty modifiers are
  applied (see Section 4).

### If `bond-match`:
- **Element/item pool**: every item available to match/drag.
  - **Pairs/missions**: each one needs a key, a display name/formula, a
    bond type (or equivalent category), and the actual pair.
  - OR **factory mode**: a list of orders (same pair/type info, plus a
    quantity), and a session duration.

### If `particle-assembly`:
- **Generators**: each countable unit the player can add — id, label,
  particle label, color, which panel it sits in.
- **Target compositions**: one per mission — the exact counts the player
  must hit, and (optionally) a result label (e.g. "Carbon-14").
- **Feedback rules**: what message shows on a mismatch, and (optionally) a
  lookup table for "you actually built X" feedback.

### If new engine:
- Describe the full content shape this mechanic needs. This becomes the
  Zod schema (`<engineName>.config.ts`) once built.

---

## 3. Quick Concepts snapshot (Optional — has fallback)

3–5 short cards shown right before the player starts, and revisitable
afterward via "View Concept Summary." Each card is **one idea**, one short
example — not a paragraph. Per the existing convention (see
`lib/content/quickConcepts.ts`): one card per real mechanic the game
actually tests (so if Section 2 lists 4 clue types, that's a natural set of
4 cards), plus a "How to Play" card and a "Stuck? Use a Hint" card.

If skipped, the game falls back to one generic line ("Get ready — your
mission is about to begin") — fine for a quick prototype, not for anything
shipped to real players.

| Card title | Body (one short idea + one short example) |
|---|---|
| How to Play | |
| | |
| | |
| | |
| Stuck? Use a Hint | |

---

## 4. Difficulty levels (Optional — has fallback, but strongly recommended)

Per the platform's design principle: **difficulty should change actual
gameplay/content, not just speed up a timer.** (This was a real bug fixed
in Element Hunter — see `lib/content/difficultyModifiers.ts`'s tile-match
entry — so it's worth being deliberate here up front rather than fixing it
later.)

For each difficulty, specify what's actually DIFFERENT about the content —
not just numbers:

- **Easy**: ______________________ (e.g. "only the simplest clue type(s),
  fewer tiles, more time")
- **Medium**: ______________________ (e.g. "adds 1-2 more clue types that
  need real understanding, not just reading a number")
- **Hard**: ______________________ (e.g. "adds the clue type that requires
  the most background knowledge, plus less time/more tiles")

If this game has genuinely distinct **levels** rather than one
difficulty-scaled session (like Atom Forge's 4 levels), list them instead:

| Level | What's different | XP |
|---|---|---|
| 1 | | |
| 2 | | |

If skipped entirely, the difficulty picker screen won't show for this game
(`engineSupportsDifficultyChoice` returns false for any engine with no
modifiers defined) — acceptable for a level-based game like Atom Forge,
not for a session-based game like Element Hunter.

---

## 5. Background illustration / environment (Optional — has fallback)

The full-bleed backdrop shown behind both the pre-play screens and live
gameplay (see `lib/content/gameEnvironments.ts`).

- **Desktop image path**: ______________________ (e.g.
  `/mascot/scene-<slug>.png`)
- **Mobile image path**: ______________________ (can be the same file as
  desktop if no separate crop exists yet)
- **Mood/setting description** (for whoever produces the art):
  ______________________
- **Accent color** (CSS variable or hex — usually derived from subject, see
  Section 1's subject choice): ______________________

If skipped, the game has no themed backdrop — it'll fall back to whatever
generic gradient the engine component defines, which is a visibly unfinished
state, not a hidden one.

---

## 6. Card art + description (Required — has placeholder fallback)

The small thumbnail shown on the homepage and `/worlds` grid (see
`lib/content/gameCardMeta.ts`). Different asset from Section 5's full
backdrop.

- **Card art path**: ______________________ (e.g.
  `/mascot/card-<slug>.svg`). If no bespoke art exists yet, name an
  existing game's art to reuse as a placeholder, and note that it MUST be
  replaced before this game is featured anywhere prominent.
- **One-sentence card description** (shown under the title on the card):
  ______________________

---

## 7. Mission Briefing flavor line (Optional — has fallback)

One narrative sentence shown at the top of the pre-play screen (see
`lib/content/missionBriefing.ts`) — excitement, not explanation. Follows
the existing "Welcome, Scientist..." framing for chemistry games; pick
whatever framing fits this game's subject/world.

- **Briefing line**: ______________________

If skipped, falls back to: *"Welcome back. Your next challenge is ready —
complete it to earn XP and keep climbing."*

---

## 8. Subject metadata — only if this is a NEW subject (Optional)

Skip this section entirely if the game uses an existing subject
(chemistry / mathematics / physics / biology already have name, emoji,
color, and tint defined in `lib/content/subjects.ts`).

If genuinely new:
- **Subject key** (slug): ______________________
- **Display name**: ______________________
- **Emoji**: ______________________
- **Accent color** (CSS variable, following the `--eg-subject-*` pattern):
  ______________________

---

## 9. Missions (Required)

At least one. For each:

- **Mission key** (slug): ______________________
- **Title**: ______________________
- **Difficulty** (`EASY` / `MEDIUM` / `HARD`): ______________________
- **Sequence index** (order within the game): ______________________
- **XP reward**: ______________________
- **Learning goal** (one sentence — shown on the briefing screen):
  ______________________
- **Estimated minutes**: ______________________
- **Payload**: (the engine-specific content this exact mission uses — see
  Section 2's shape)

---

## 10. Mission Objectives checklist (Optional — inherited from engine)

A short ✓ checklist shown briefly before Quick Concepts. This is keyed by
**engine**, not by game (see `lib/content/missionObjectives.ts`) — so if
this game reuses an existing engine, it gets that engine's objectives for
free, and you can skip this entirely unless this specific mission needs to
add something extra (e.g. "Finish before the timer expires" on a timed
level).

- **Override needed?** (leave blank if reusing the engine's default)
  - ______________________
  - ______________________
  - ______________________

---

## 11. Open questions / unresolved decisions

Anything still undecided when this spec gets handed off — list it here so
it isn't silently guessed at during implementation.

- ______________________
