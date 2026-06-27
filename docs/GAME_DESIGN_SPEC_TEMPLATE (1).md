# EXL Game Design Specification — Template

> Fill out this entire document BEFORE writing any code for a new game,
> per the Universal Game Design Framework, Part 8 ("Scalable Development
> Workflow"). This is the artifact that workflow step 2 ("Complete the
> Game Design Specification") actually produces.
>
> A worked example (Atom Forge, a real, already-shipped game) follows
> this blank template — fill in your new game's spec the same way, then
> use it to decide: does an EXISTING engine in `src/engines/` already fit
> this game's "Core Gameplay Mechanic," or is this the rare case that
> genuinely needs a new one (see Part 8 step 10, and
> `src/engines/_future/README.md`)?
>
> ---
>
> ## Honesty note on sourcing this document
>
> This template was assembled directly from the real, current codebase —
> reading `src/engines/*/​*.config.ts`, `src/lib/`, and the actual content
> JSON under `src/content/games/` — NOT from a separate architecture
> document. Code comments throughout this repo reference an "architecture
> doc" by section number (e.g. "Section 3.1," "Section 8.1") that is not
> included in this checkout (only `src/` was provided). If that document
> exists elsewhere, reconcile it against this template before treating
> either as the sole source of truth; until then, this template is
> grounded in what the running code actually does today.

---

## Part 1 — Game Definition

| Field | Your Answer |
|---|---|
| **Game Name** | |
| **Subject** | One of: `chemistry`, `mathematics`, `physics`, `biology` (matches `GameRow.subject` — see Part 4 note on adding a new subject) |
| **Topic / Subtopic** | A slug, e.g. `chemical-bonding` / `ionic-bonds`. No human-readable label is stored for these yet (see `EntryScreen.tsx`'s `fallbackLearningGoal`) — write the Learning Goal sentence below to cover that gap |
| **Learning Objective** | One sentence: what should the student be able to DO after this, not just "know about X" |
| **Target Difficulty** | Default tier shown if the player makes no choice (EASY / MEDIUM / HARD) — see Part 6 |
| **Estimated Play Time** | Minutes, per mission. Stored as `MissionRow.estimated_minutes` (nullable — see migration note in Part 8 below) |
| **Core Gameplay Mechanic** | Name the *engine family* this matches — see the Engine Fit Check below before assuming you need a new one |
| **Win Condition** | What ends the mission successfully |
| **Lose Condition** | What ends it unsuccessfully, if anything — some engines (e.g. `particle-assembly`) have no fail state, only "not yet correct" |
| **Scoring Method** | XP-only completion? Time/accuracy-weighted score? See Part 3 below |

### Engine Fit Check (do this before "Core Gameplay Mechanic" above)

Before assuming a new engine is needed, check whether an existing one already fits:

- **bond-match** — player drags/pairs two items together to form a correct combination (ionic/covalent bonds today; could generalize to any "combine A+B correctly" mechanic)
- **particle-assembly** — player adds discrete countable units from fixed generators into one target composition, checked on submit (atoms from protons/neutrons/electrons today; generalizes to any "build the right combination of parts" mechanic)
- **tile-match** — a clue is shown, player taps the matching tile(s) from a grid, loops many rounds in one timed session
- **multi-stage** — NOT YET BUILT (see `src/engines/multi-stage/README.md`) — planned for games that are genuinely a sequence of independently-scored stages, not one repeated mechanic. If your game needs this shape, it's a real signal to build this engine, not reuse an existing one that doesn't fit

If none fit, that's a real signal for a new engine — drop a note in `src/engines/_future/README.md` describing the new interaction shape before building it, per that file's own instructions.

**Validated against the 3 real games that already exist**, not just asserted:
- Atom Forge → bond-match ✓ (used as the worked example below)
- Build The Atom → particle-assembly ✓ ("adds discrete countable units... into one target composition, checked on submit" — matches exactly: proton/neutron/electron counts toward a target like Carbon-14's 6/8/6)
- Element Hunter → tile-match ✓ ("a clue is shown, player taps the matching tile(s)... loops many rounds in one timed session" — matches exactly: a 3-tier escalating-clue hunt across one 60-second session)

All three existing games land cleanly in the Engine Fit Check's three real
engines with no awkward fit — useful evidence the check is doing real
work, not just describing the engines that happen to exist.

---

## Part 2 — Learning Content

### Mission Briefing

A short narrative paragraph — NOT a fact sheet. Real example (Atom Forge,
from `lib/content/missionBriefing.ts`):

> "Welcome, Scientist. The laboratory's element database has become
> disorganised — bond the right atoms together before the system fails."

Write yours: answers *why am I here* before any numbers appear on screen.
Per the latest mission-flow brief: keep the Mission Briefing screen
uncluttered — Learning Goal stays visible, but Reward/Difficulty/Time
should be a single quiet line, not competing boxes (see
`EntryScreen.tsx`).

### Learning Goal

One sentence, the concept itself — not the briefing's narrative framing.
Real example: *"A metal GIVES an electron to a non-metal"* (ionic
bonding, Atom Forge Level 1). Stored as `MissionRow.learning_goal`
(nullable — see Part 8 migration note).

### Mission Objectives

3-4 short check-mark lines, action-oriented, no paragraphs. Keyed per
ENGINE in `lib/content/missionObjectives.ts` (not per mission — see that
file's header for why: identical mechanics shouldn't repeat
slightly-reworded objectives across every mission of the same game).

Real example (bond-match):
- Bond the correct pair of atoms together.
- Match each compound the mission asks for.
- Finish before time runs out.

### Quick Concepts

2-4 titled cards, ONE idea per card. Real example (Atom Forge Level 1,
from `content/games/chemistry/atom-forge.json`'s `snapshot.cards`):

1. **Ionic Bonds** — "A metal GIVES an electron to a non-metal."
2. **Covalent Bonds** — "Two non-metals SHARE electrons instead."
3. **How to Play** — "Drag two atoms close together to bond them."

Implemented by `components/runtime/ConceptSnapshot.tsx` — supports
Back/Next between cards, a Skip button (only on first viewing per engine,
via `lib/content/conceptPrefs.ts`), and reopening after the mission
completes ("View Concept Summary" on the Reflection screen).

---

## Part 3 — Gameplay Design

| Field | Where it actually lives in code |
|---|---|
| **Core interaction** | The engine component itself, `src/engines/<engine>/<Engine>Engine.tsx` |
| **Game loop** | `components/runtime/GameRuntime.tsx` — the SAME for every game: Concept Snapshot, engine mounts, onComplete fires, AttemptResult is built, POSTed or queued offline, then the Reflection screen shows |
| **Difficulty progression** | See Part 6 below — this is the player-choice system, not mission-to-mission escalation |
| **Scoring system** | Per-attempt: whatever the engine reports in its raw outcome (`success`, `score`, `timeSpentSec`, `attemptsBeforeSuccess` — see `types/result.ts`'s `AttemptResult`). Long-term mastery: `lib/scoring/masteryFormula.ts`'s weighted-average update, independent of any one attempt |
| **Hint system** | Per engine, inside the engine component itself — must TEACH, not solve (e.g. bond-match's hint reveals bond TYPE, never which two atoms to drag) |
| **Timer (if applicable)** | Only where the mechanic actually has one — `factory.sessionDurationSec` (bond-match), `sessionDurationSec` (tile-match). `particle-assembly` has none; don't add a fake one just for symmetry (see Part 6) |
| **Rewards / XP** | `MissionRow.xp_reward`, surfaced on `ReflectionScreen` as a reward chip. No "coins" concept exists anywhere in the schema yet — don't reference coins in new game copy until that's real (see `lib/content/gameCardMeta.ts`'s comment on the same gap) |
| **Achievements** | Not implemented anywhere yet — flagged as a known platform gap, not specific to your game |

**Multi-question levels**: per Part 3's own instruction ("Avoid
one-question levels except where intentionally used as tutorials") — this
is already enforced structurally: `PlayClient.tsx` treats a game as
*level-based* only when its missions' difficulty actually varies
(`isLevelBased`), and each engine's own config (e.g. bond-match's
`missions: BondMissionSchema[]`) is itself a list, not a single question.

---

## Part 4 — Game Environment

| Subject | Real existing assets/treatment |
|---|---|
| Chemistry | `/mascot/scene-backdrop.svg` (EntryScreen backdrop), periodic-table glyph preview (`motion/periodicTableData.ts`, `motion/PeriodicTableReveal.tsx`) for particle-assembly missions reporting a proton count |
| Mathematics | No game-specific environment art yet — `content/games/mathematics/README.md` is still an empty placeholder |
| Physics | No game-specific environment art yet — same placeholder state |
| Biology | No game-specific environment art yet — same placeholder state |

**Adding a new subject**: `lib/content/subjects.ts`'s `subjectMeta()`
already falls back gracefully (auto-capitalized label, generic emoji,
brand-color accent) for any subject key not yet in `SUBJECT_META` — but
that fallback is a *placeholder*, not a finished environment. Add a real
entry there (name, emoji, and a `--eg-subject-*` accent token in
`motion/tokens.css`) as part of this Part 4 step, before the game ships,
not after.

Per the brief: environment is atmosphere, not the focus — this matches
the existing visual language exactly (`EntryScreen`'s backdrop sits
behind a centered card; the brief's "should not distract from gameplay"
is already the working assumption across every existing screen).

---

## Part 5 — Environment Asset Planning

| Asset | Required? | Existing precedent |
|---|---|---|
| Background Environment | Yes | `/mascot/scene-backdrop.svg` |
| Character / Mascot | Yes, for every pre/post-gameplay screen | `motion/Mascot.tsx` — has `idle`, `celebrate`, and `encourage` poses today (three total, kept deliberately bounded as the catalog grows — see that file's own comment); request a new pose explicitly only if your game genuinely needs a fourth, and check whether `encourage` already covers it first |
| Interactive Objects | Engine-specific | e.g. bond-match's draggable atom tokens (`engines/bond-match/bondData.ts`) |
| Decorative Foreground Elements | Optional | None yet beyond the backdrop and mascot |
| Icons | Yes | Emoji are the current placeholder convention throughout (`lib/content/subjects.ts`, game cards) — fine for now, but flagged in `lib/content/gameCardMeta.ts`'s own comment as needing real bespoke art eventually |
| Illustrations | Game-card specific | `lib/content/gameCardMeta.ts`'s `GAME_CARD_ART` — currently incomplete: only 2 of 3 chemistry games have real card art; the third (`build-the-atom`) reuses another game's art as a stopgap. Don't repeat that gap for a new game — author real art before shipping, or at minimum register an honest placeholder with a comment, the way that file does |
| Victory Graphics | Partial | `ReflectionScreen`'s reward chip (XP pop animation) plus `PeriodicTableReveal` for particle-assembly. No subject-specific victory illustration exists yet |
| Reward Graphics | Partial | Same as above — XP chip only; no coin or badge imagery exists since neither system is real yet |

If custom artwork is required, write the image-generation prompt and get
it approved BEFORE implementation begins, per the brief's own instruction
— don't let placeholder emoji art quietly become permanent the way it has
for several existing games.

---

## Part 6 — Difficulty Framework

Every game should define what EASY, MEDIUM, and HARD actually change
mechanically — not just a timer. See `lib/content/difficultyModifiers.ts`
for the real, current implementation and worked examples:

| Engine | Easy | Medium | Hard |
|---|---|---|---|
| bond-match | Element pool trimmed to only what's needed (no distractors), longer timer, hints on | Authored pool as-is, standard timer, hints on | Pool gains 2 real distractor elements, shorter timer, hints off |
| tile-match | Smaller board (4 tiles), longer timer | Standard board (6 tiles) | Larger board (9 tiles), shorter timer |
| particle-assembly | Full detailed feedback, target numbers visible on every counter | Same as Easy | Feedback trimmed to generic messages (both rule types, not just one — see the worked example below for why), target numbers hidden entirely on every counter |

**A known honest limitation, not a hidden one**: bond-match's Easy-mode
pool trim is currently a no-op on every shipped Atom Forge level, because
none of them were authored with extra "slack" elements beyond what's
strictly required — there's nothing to trim yet. The mechanism is real
and will matter the moment a level is authored with deliberate slack in
its pool; it isn't fake, but don't claim Easy currently feels different
on Atom Forge until that authoring happens.

When designing a NEW engine's difficulty tiers, the test is: if a player
couldn't see the difficulty label, would Easy and Hard actually play
differently? If the honest answer is "only the clock," go back and find
a real mechanical lever (board size, distractor count, hint verbosity,
tolerance for error) before shipping.

---

## Part 7 — Review & Replay

| Brief asks for | Implemented as |
|---|---|
| Final Score | `ReflectionScreen`'s reward display (currently XP-only; "final score" beyond XP is engine-specific, e.g. bond-match factory mode's `finalScore`) |
| XP Earned | `ReflectionScreen`'s reward chip, wired from `mission.xpReward` |
| Coins Earned | Not implemented — no coins column exists anywhere in the schema. Do not add coin copy to a new game until this is real platform-wide |
| Leaderboard Position | Not implemented — no leaderboard query exists anywhere. The homepage has a leaderboard UI slot that renders an honest empty state for exactly this reason |
| Review Quick Concepts | Implemented — `ReflectionScreen`'s "View Concept Summary" reopens `ConceptSnapshot` in a no-skip-button revisit mode |
| Replay Mission | Implemented — `ReflectionScreen`'s "Play Again" |
| Try a Higher Difficulty | Not implemented as a direct action yet — the player can back out and re-pick on `DifficultySelectScreen`, but there's no one-tap "play this again, harder" shortcut from Reflection. Worth adding once a second game proves the same pattern is needed twice |
| Play Another Game | Implemented indirectly — `SiteHeader`'s Games nav, not a direct link from Reflection itself |

---

## Part 8 — Scalable Development Workflow (applied)

The brief's 10-step workflow, with the artifact each step actually
produces in this codebase:

1. Define the game concept — informal, not yet templated beyond this doc
2. Complete the Game Design Specification — this document
3. Write the Mission Briefing — entry in `lib/content/missionBriefing.ts`
4. Define the Learning Goal — `MissionRow.learning_goal` per mission (requires the migration noted below)
5. Create the Mission Objectives — entry in `lib/content/missionObjectives.ts`, keyed by engine type
6. Prepare the Quick Concepts — `snapshot.cards` in the game's content JSON
7. Design the gameplay mechanics — the engine's `.config.ts` (Zod schema) plus `<Engine>Engine.tsx` (or reuse an existing engine, see Part 1's Engine Fit Check)
8. Plan the game environment — Part 4 above
9. Prepare visual asset prompts — Part 5 above
10. Implement using the shared engine — register in `engines/registry.ts`

**Outstanding migration note** (affects steps 3-6): `MissionRow.learning_goal`
and `MissionRow.estimated_minutes` were added to the TypeScript types and
Zod schema, and ALL THREE existing chemistry games' content JSON now have
real, mission-specific values for both fields (Atom Forge, Build The
Atom, and Element Hunter — no remaining gaps in this set). The actual
Postgres migration that adds these columns is still NOT in this checkout
(no `supabase/migrations/*.sql` was ever included in this project
upload), so until that migration runs and the seed script is updated to
write these two fields, the authored content above won't actually
persist into the live database — every screen reading these fields
continues to fall back gracefully (a derived label, a hidden time row)
in the meantime, rather than crashing.

---

## Worked Example — Atom Forge (filled out against the real, shipped game)

### Part 1 — Game Definition

| Field | Answer |
|---|---|
| Game Name | Atom Forge |
| Subject | chemistry |
| Topic / Subtopic | `chemical-bonding` / varies per level (`ionic-bonds`, `covalent-bonds`, etc.) |
| Learning Objective | Identify whether two elements bond ionically or covalently, and correctly pair them |
| Target Difficulty | MEDIUM (default; player can choose otherwise via DifficultySelectScreen) |
| Estimated Play Time | 3-5 minutes per level (see each mission's `estimatedMinutes` in content JSON) |
| Core Gameplay Mechanic | bond-match (drag two atoms together to bond them) |
| Win Condition | All requested compounds bonded correctly (level mode) or quota met before timer ends (factory mode, Level 4) |
| Lose Condition | Factory mode: timer reaches zero before quota met. Level mode: no fail state, just retry |
| Scoring Method | Per-bond XP in level mode; speed, accuracy, and volume in factory mode (`BondMatchFactoryOutcome`) |

### Part 2 — Learning Content (Level 1 example)

- **Mission Briefing**: "Welcome, Scientist. The laboratory's element database has become disorganised — bond the right atoms together before the system fails."
- **Learning Goal**: "A metal GIVES an electron to a non-metal."
- **Mission Objectives**: Bond the correct pair of atoms together. Match each compound the mission asks for. Finish before time runs out.
- **Quick Concepts**: Ionic Bonds, then Covalent Bonds, then How to Play (3 cards — see content JSON)

### Part 6 — Difficulty (this specific game)

- EASY: pool trimmed (currently a no-op — see the honest limitation noted in Part 6 above), hints on, 90s
- MEDIUM: authored pool as-is, hints on, 60s
- HARD: two distractor elements added (real elements not already in the pool), hints off, 40s

This worked example is what every future game's spec should look like
once filled in — concrete, citing real files, and honest about what
isn't finished yet rather than describing an idealized version of the
game.

---

## Worked Example 2 — Build The Atom (a deliberately different engine)

Atom Forge above exercises bond-match. This second example exercises
particle-assembly — untimed, no fail state, isotope-aware — specifically
to prove the template holds up against a mechanic that doesn't share
bond-match's clock-and-pairs shape.

### Part 1 — Game Definition

| Field | Answer |
|---|---|
| Game Name | Build The Atom |
| Subject | chemistry |
| Topic / Subtopic | `atomic-structure` / `protons-neutrons-electrons` |
| Learning Objective | Given a target element or isotope, assemble the correct number of protons, neutrons, and electrons |
| Target Difficulty | EASY (this game's missions are content-sequence-based, not level-based — see `PlayClient.tsx`'s `isLevelBased` check; no DifficultySelectScreen modifier currently does anything mechanically meaningful here beyond hint verbosity — see Part 6) |
| Estimated Play Time | 2-4 minutes per mission (lowest for Hydrogen/Helium, highest for the Carbon-14 isotope — see content JSON) |
| Core Gameplay Mechanic | particle-assembly (add particles from generators until the live counts match a target) |
| Win Condition | Proton, neutron, and electron counts all exactly match the target composition on submit |
| Lose Condition | None — there is no fail state, only "not yet correct," consistent with the Engine Fit Check's own description of this engine family |
| Scoring Method | XP on successful match only; no partial credit for a partially-correct build |

### Part 2 — Learning Content (Carbon-14 example — the hardest of the six missions)

- **Learning Goal**: "Isotopes share the same proton count but differ in neutrons — Carbon-14 has 2 more neutrons than standard Carbon-12."
- **Why this mission is harder than the other five**: every other mission in this game targets the standard, most-common isotope of its element (neutrons = protons, or close to it); Carbon-14 is the one mission that deliberately breaks that pattern, which is exactly why its Learning Goal needs to say so explicitly rather than reuse generic "protons/neutrons/electrons" framing

### Part 6 — Difficulty (this specific game, and its real limitation)

particle-assembly has no timer to vary (see Part 6 above), so this
game's EASY/MEDIUM/HARD differ in two real, paired levers:
`feedbackRules` verbosity AND `hideTargetNumbers` (a config field added
specifically for this — see `particleAssembly.config.ts` and
`GeneratorPanel` in the engine component). On HARD, the player can no
longer see each counter's "/ N" target, and the failure-feedback text no
longer leaks that number either (both `proton_count_mismatch` and
`any_mismatch` rules are overridden together — overriding only one would
have left a loophole where the hidden number was still spoken aloud in
the mismatch message). That's a genuine gameplay change for an otherwise
untimed, no-fail-state mechanic, not just less hand-holding text.
