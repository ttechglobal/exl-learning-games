# Build Log & Roadmap

Running log of fixes, in-progress work, and planned features across the
platform. Newest entries at the top of each section. Each item should have
enough detail that picking it up later doesn't require re-deriving context
from scratch.

**How to use this file:**
- New idea / thing to fix → add it to **Planned**, in the right priority
  bucket, with enough detail to act on later without re-investigating.
- Started working on it → move it to **In Progress**.
- Shipped → move it to **Done**, with the date and a one-line summary of
  what actually changed (and which files).
- If something gets explicitly decided against, log it in **Decided
  Against** with the reason — saves re-litigating it later.

---

## In Progress

*(Nothing currently in progress.)*

---

## Planned

### High priority

- **`student.external_id` needs a DB-level UNIQUE constraint.** The new
  anonymous-identity system (`getOrCreateStudentByDeviceId` in
  `lib/db/queries/students.ts`) relies on `external_id` being unique per
  device, and the application code handles a concurrent-insert race
  gracefully (recovers instead of throwing — verified via a dedicated
  test), but no `supabase/migrations/*.sql` exists in this checkout to
  add the actual constraint at the schema level. Add it when migrations
  are next touched, so the race becomes provably impossible at the DB
  layer rather than just handled defensively in application code.

- **Bespoke backdrop art needs to actually be generated.** Generation
  prompts (desktop 16:9 + mobile 9:16, for both Element Hunter and
  Carbon Builder) are ready at `docs/BACKDROP_ART_PROMPTS.md`, written
  against the real technical constraints (767px breakpoint, `object-fit:
  cover`, mobile crop bias) and this app's actual style anchors. Once
  generated, drop the files at the paths already wired in
  `gameEnvironments.ts` — no further code change needed for the desktop
  variant; if a genuinely separate mobile crop is produced (recommended,
  rather than reusing the desktop file for both), update that one
  `mobile:` path per game in `gameEnvironments.ts`.

- **Quick Concepts cards missing Period / Mass Number coverage.**
  `lib/content/quickConcepts.ts`'s Element Hunter card set was written
  when the only clue types were atomic number, group, and valence. The
  difficulty-segregation update added `period`, `electron_number`, and
  `mass_number` as real clue types (Medium/Hard tiers now use them), but
  no Quick Concept card teaches Period or Mass Number before the player
  hits them in-game. Add 1-2 cards covering those, following the existing
  "one idea, one short example" format.

- **Element Hunter's card description is stale.**
  `lib/content/gameCardMeta.ts`'s `GAME_CARD_DESC["element-hunter"]` says
  "Race the clock to spot elements by atomic number, group, and valence
  electrons" — written before the difficulty fix. Now Easy doesn't touch
  group/valence at all, and Hard adds mass number too. Either generalize
  the line (drop the specific clue-type list) or make it difficulty-aware
  copy.

- **`tile-match`'s Mission Objectives text describes the wrong mechanic.**
  `lib/content/missionObjectives.ts`'s `OBJECTIVES_BY_ENGINE["tile-match"]`
  reads "Find and match the correct pairs of tiles" / "Clear the whole
  board" — that's pairs-matching/board-clearing language, but Element
  Hunter is a timed clue-and-tap session with no "board cleared" end
  state. Rewrite to something like "Read the clue and tap the matching
  element," "Build a streak for bonus points," "Beat the clock." Since
  this is keyed by engine (not per-game), check whether any other planned
  tile-match game would still want pairs-matching language before
  rewriting — if a second tile-match game genuinely IS a pairs-matching
  game, this may need to move to a per-game override instead of a
  blanket engine-level rewrite.

### Medium priority

- **Carbon Builder follow-ups before shipping to real players.** Engine,
  content (11 missions), and progression architecture are all built and
  validated (see Done, above). Remaining: (1) bespoke background/card
  art — generation prompts now ready (see High priority, above) but the
  actual image files still need generating; (2) topic/subtopic ID
  values are placeholders pending confirmation against the real content
  taxonomy; (3) per-mission XP values, sequence indices, and estimated
  minutes need final numbers for DB seeding; (4) Carbon Builder's `game`
  row needs `progression_mode` explicitly set to `"trackMap"` at seed
  time; (5) `TrackMapScreen.tsx` currently reuses `LevelSelectScreen`'s
  inline-style visual approach rather than a proper CSS module — worth a
  polish pass alongside the bespoke art in (1), since the two should
  likely be designed together. None of these are technical blockers —
  all content-tuning/asset/seeding work.

- **Per-subject common visual theme.** Raised as a future direction:
  games within a subject should feel like they share a world/theme, not
  just a subject-color accent. `lib/content/subjects.ts` already
  centralizes name/emoji/color/tint per subject, which is a head start,
  but an actual shared visual language (background motifs, mascot
  framing, etc.) per subject hasn't been designed yet. Needs a design
  pass before it's an engineering task.

### Low priority / nice-to-have

- *(Nothing logged yet.)*

---

## Decided Against

- *(Nothing logged yet.)*

---

## Done

### 2026-06-29 (cont.) — Anonymous global identity, leaderboard fix, Easy timer, art prompts
Three more requests this round: fix Element Hunter's Easy timer, make
leaderboards/high-scores genuinely global without requiring sign-in, and
produce bespoke-art generation prompts for the two still-placeholder
backdrops.

**Easy timer**: `difficultyModifiers.ts`'s tile-match EASY entry reduced
`sessionDurationSec` from 90 to 60, per direct instruction. Flagged
explicitly in a code comment: this makes Easy and Medium the same
duration (60s each) — the difficulty gap between them is now carried
entirely by which clue types appear (Easy: atomic_number/electron_number
only; Medium: + period/valence), not by time pressure at all. Surfaced
this rather than letting it pass silently, in case collapsing the
Easy/Medium time gap wasn't the intended outcome.

**Leaderboard identity — the actual root cause.** Investigated before
touching anything: the real, server-backed, globally-visible leaderboard
queries (`getWeeklyLeaderboard`, `getGameLeaderboard` in
`lib/db/queries/leaderboard.ts`) already existed and were already
correct — that was never the broken part. The actual bug: every single
visitor's attempts were being written under one hardcoded
`PLACEHOLDER_STUDENT_ID` UUID shared by literally everyone, so the
leaderboard had no way to show distinct players even though it was
mechanically working and visible to all. Confirmed via a full trace of
every file referencing `studentId` (14 files) that this was the only
place identity was actually faked — every query/component downstream
already correctly threads through whatever ID it's given.

Built a full anonymous, no-sign-in identity system per your explicit
decisions (cookie-based, acceptable that clearing cookies/switching
devices starts a new player; name prompt on first-ever app open, not
deferred to first leaderboard qualification):
- **`eg_device_id` cookie** (1-year expiry, httpOnly) — minted via a new
  `/api/identity` Route Handler (Server Components can't set cookies
  during render, so this round-trip is required; see
  `lib/identity/deviceId.ts`'s comment for the full explanation).
- **`getOrCreateStudentByDeviceId`** (new, in a new
  `lib/db/queries/students.ts`) — resolves a device cookie to a real,
  persistent `student` row via the previously-unused
  `student.external_id` column, creating one on first sight. Includes
  explicit insert-race recovery (two near-simultaneous first visits from
  the same brand-new device) rather than surfacing an error for what's a
  successful identity resolution either way.
- **`IdentityBootstrap`** (new client component, mounted in
  `app/layout.tsx` alongside `ThemeProvider`) — calls `/api/identity` on
  every load so identity resolves before anything needs it, and shows
  the one-time name prompt (skippable, defaults to "Anonymous") gated by
  a separate localStorage flag so it never repeats for an already-seen
  browser.
- **`page.tsx`** (play route) and the previously-never-wired root
  **`page.tsx`** (homepage) now call `resolveCurrentStudent()` instead of
  the placeholder — the homepage leaderboard section (`HomePage.tsx`
  already had the prop plumbing from an earlier honest-gap note, just
  nothing upstream ever called it) is now actually live.

Verified via: a dedicated 14-assertion behavioral test against a mocked
Supabase client, covering same-device idempotency, distinct devices
getting distinct students, create-time-only display names, the
display-name update path, blank-name fallback, and — after catching and
fixing a real bug in the test's OWN race simulation (an earlier version
accidentally tested a different, already-covered code path) — a
genuine concurrent-insert-conflict recovery scenario. Full from-scratch
project TypeScript compile (including `next/headers`' `cookies()`
typing) — zero errors, no regressions.

**Art prompts**: `docs/BACKDROP_ART_PROMPTS.md` — desktop (16:9) +
mobile (9:16) generation prompts for both Element Hunter's and Carbon
Builder's backdrops, written against the actual technical constraints
(767px breakpoint, `object-fit: cover`, mobile crop biased to `center
75%` — so prompts explicitly ask for important content in the lower
two-thirds and a simple/croppable top edge) and the app's real style
anchors (Baloo 2's rounded friendly register, chemistry purple `#7b4fcb`,
gold `#ffb23c`, Carbon Builder's actual atom-sphere colors). Includes a
consistency check against Atom Forge's existing backdrop so all three
games read as one illustrated world.

Files: `lib/content/difficultyModifiers.ts`, `lib/db/queries/students.ts`
(new), `lib/identity/deviceId.ts` (new), `app/api/identity/route.ts`
(new), `components/identity/IdentityBootstrap.tsx` + `.module.css` (new),
`app/layout.tsx`, `app/(player)/play/[gameSlug]/page.tsx`, `app/page.tsx`,
`docs/BACKDROP_ART_PROMPTS.md` (new).

Still open: a DB-level UNIQUE constraint on `student.external_id` isn't
present in this checkout (no migration files exist here) — the
insert-race recovery code handles the rare case gracefully either way,
but the constraint itself should still be added at the schema level when
migrations are next touched, so the race becomes provably impossible
rather than just handled. The actual bespoke art images still need to be
generated from the prompts and dropped at the file paths already wired
in `gameEnvironments.ts`.

### 2026-06-29 — Carbon Builder: more Easy missions + real progression architecture
Two follow-up requests: more Easy missions, and how mission-to-mission
progression actually works. The second gated the first — see
`docs/carbon-builder.md` Section 13 for the full account.

Found that `PlayClient.tsx`'s existing "level-based" detection
(inferred purely from mixed difficulty values across a game's missions)
was already silently misclassifying Carbon Builder: its EASY/MEDIUM/HARD
sequence is one staged path, not free-choice levels, but the same mixed-
difficulty signal Atom Forge's real levels produce — so every mission
completion was returning the player to a flat, unordered picker instead
of ever auto-advancing, even Methane → Ethane.

Per your decision: built a locked-path track map (mission N+1 stays
locked until N has a successful attempt). Rather than special-case
Carbon Builder, added this as a third explicit, reusable progression
mode (`GameRow.progression_mode: "linear" | "levelSelect" | "trackMap"`,
nullable so existing games fall back to the old inferred behavior with
no migration needed). New pieces: `TrackMapScreen.tsx` (locked/unlocked/
completed visual states), `listCompletedMissionIdsForStudent` (new query
— a mission only counts as completed on a successful attempt, not just
any attempt), and a rewired `PlayClient.tsx`/`page.tsx` that auto-
advances through the track on success while keeping the map reachable
via Back.

Added 3 new Easy missions before Methane, per your call on placement:
Hydrogen gas (H₂) — simplest possible case, one bond, both atoms hit
cap 1 at once; Water (H₂O) — introduces a different cap (oxygen=2) and
the first central-atom shape; Chlorine gas (Cl₂) — reinforces the
single-bond pattern with a new atom right before Methane scales the same
rule up to carbon's cap of 4. All 11 missions (3 new + original 8)
re-verified against the content validator and real Zod schemas.

Verified via: a new 13-assertion test for the lock-state derivation
logic (new student, partial completion, a sequential-gap edge case
deliberately documented as an accepted boundary rather than guarded
against, full completion); re-run of the full mission content/schema
validation suite; and a from-scratch full-project TypeScript compile
(not just the new files in isolation) — zero errors.

Files: `types/db.ts` (new `progression_mode` column),
`TrackMapScreen.tsx` (new), `lib/db/queries/attempts.ts` (new
`listCompletedMissionIdsForStudent`), `PlayClient.tsx` (rewired),
`page.tsx` (fetches completion data only for trackMap games),
`carbonBuilderMissions.ts` (3 new missions + explicit ordering export).

Still open: `progression_mode` needs to actually be set to `"trackMap"`
on Carbon Builder's DB row at seed time (column/read-path are built;
this is a seeding step). `TrackMapScreen.tsx` reuses
`LevelSelectScreen`'s inline-style approach rather than a proper CSS
module — fine functionally, worth revisiting alongside Carbon Builder's
still-outstanding bespoke art.

### 2026-06-28 — Carbon Builder: new `molecule-builder` engine built end-to-end
Full spec at `docs/carbon-builder.md` (Section 12 has the implementation
record). Built a genuinely new engine — confirmed neither `bond-match`
(pairwise, resolve-and-clear, no per-atom capacity tracking) nor
`particle-assembly` (anonymous countable units, no real bonds) fit the
mechanic of "drag atoms, bond them by hand, enforce each atom's real max
bond capacity." Carbon's tetravalency (4-bond limit) is enforced as a
hard rejection at bond-creation time, not caught after the fact on
submit — the literal implementation of "carbon cannot have more than
four bonds" from the original brief.

Design calls made while building (all logged in the spec's Open
Questions, Section 11): slot-based build-surface layout instead of
freeform drag physics (chosen so multi-carbon chains don't become a
pixel-nudging UX tax unrelated to the chemistry); specific wrong-submit
feedback naming the actual atom and its current/max bond count (mirrors
`particle-assembly`'s `buildFeedback` pattern); fixed XP on correct
submit with tracked-but-not-penalized attempts; Ethyne (C₂H₂) for the
triple-bond mission and Isobutane (C₄H₁₀, branched) for the
branched-chain mission — isobutane specifically because it shares
butane's exact formula while being structurally distinct, which makes
the branching lesson concrete.

8 missions built and hand-verified against real molecular formulas
before being encoded: methane, ethane, propane, butane, pentane (Easy →
Medium single-bond chain progression), then ethene, ethyne, isobutane
(Hard tier — double bonds, triple bonds, branching).

Files: `moleculeBuilder.config.ts`, `moleculeBuilder.logic.ts`,
`atomRoster.ts`, `carbonBuilderMissions.ts`, `validateMissionContent.ts`,
`MoleculeBuilderEngine.tsx`, `MoleculeBuilderEngine.module.css`, plus a
`molecule-builder` registry entry and content-layer additions across
`gameEnvironments.ts`, `gameCardMeta.ts`, `missionBriefing.ts`,
`quickConcepts.ts`, and `missionObjectives.ts`.

Verified via: a standalone content validator (bondableTo symmetry,
slot/target agreement, exact bond-capacity-weight matching) against all
8 missions; real Zod schema validation of every mission payload plus a
negative test confirming malformed content is rejected; a 30-assertion
gameplay stress test covering the exact "5th bond on carbon rejected"
scenario, hydrogen's 1-bond limit, ethene's double-bond weight, and
isobutane's branch-point carbon; and a full TypeScript compile against
the real `GameplayShell`/`Mascot`/`payoffSequence`/`playSound` modules
(not stubs), confirming zero errors and no regressions to the three
pre-existing engines.

### 2026-06-28 — Element Hunter: real difficulty segregation by clue type
Easy/Medium/Hard previously only changed `sessionDurationSec` and
`tileCount` — the actual clue-type mix (atomic number, group, valence) was
identical across all three difficulties, so "Easy" still threw
group/valence questions at the player. Fixed by:
- Adding `period` and `mass` fields to every element in
  `engines/tile-match/elementData.ts` (36 elements, periods 1-4).
- Adding two new clue types, `electron_number` and `period` and
  `mass_number`, to `engines/tile-match/tileMatch.config.ts`'s `ClueType`
  enum, with full generation logic in `tileMatch.logic.ts` and hint
  content in `teachingHints.ts`.
- Rewriting `lib/content/difficultyModifiers.ts`'s `tile-match` entry so
  each difficulty fully replaces the session's `tiers` array with a single
  locked-down `clueTypes` set: Easy = atomic number + electron number
  only; Medium = + period + valence; Hard = + mass number + group.
- Verified via a standalone TypeScript compile of the changed files and a
  1,500-round runtime simulation across all three difficulties (zero
  clue-type leakage across tiers, zero unsolvable rounds, including the
  mass-number collision case where two elements round to the same value).

Files touched: `elementData.ts`, `tileMatch.config.ts`, `tileMatch.logic.ts`,
`teachingHints.ts`, `difficultyModifiers.ts`.

Known follow-ups from this change are logged above under Planned (Quick
Concepts coverage, stale card description, stale objectives text).
