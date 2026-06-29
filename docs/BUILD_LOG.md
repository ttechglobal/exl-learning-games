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

- **`particle-assembly` has the same latent mission-payload bug
  Carbon Builder just hit.** Confirmed via direct code trace while
  fixing Carbon Builder's crash: `ParticleAssemblyEngine.tsx` accesses
  `mission.target` directly, but `GameRuntime.tsx`'s real
  `GameRuntimeMission` shape keeps mission content nested under
  `mission.payload` — the exact same flattened-access mistake that
  crashed `MoleculeBuilderEngine.tsx` with "Cannot read properties of
  undefined (reading 'map')." Not yet fixed (not reported broken, out
  of this round's scope), but this WILL crash Build the Atom the moment
  its config object takes this exact path through `GameRuntime`. Fix:
  same pattern as Carbon Builder's fix — change
  `ParticleAssemblyConfig`'s mission type to nest payload correctly
  (`mission: {id, title, xpReward, payload: ParticleAssemblyMissionPayload}`
  instead of the current flattened intersection type) and update every
  `mission.X` access in the component to `mission.payload.X`.

- **Bespoke full-bleed BACKDROP art still needs to actually be
  generated.** Generation prompts (desktop 16:9 + mobile 9:16, for both
  Element Hunter and Carbon Builder's full-bleed background — NOT the
  worlds-list card icon, which is now resolved via hand-built SVG, see
  Done above) are ready at `docs/BACKDROP_ART_PROMPTS.md`, written
  specifically for Gemini's image generation, with the crop-safety and
  audience requirements folded directly into the scene description
  rather than appended as separate rules. Once generated, drop the
  files at the paths already wired in `gameEnvironments.ts` — no
  further code change needed at the desktop/default resolution; if a
  genuinely separate mobile crop is produced, update that one `mobile:`
  path per game.

- **`build-the-atom` still reuses Atom Forge's placeholder card art.**
  Same gap flagged in an earlier round, not yet fixed — `gameCardMeta.ts`'s
  `GAME_CARD_ART["build-the-atom"]` still points at
  `/mascot/card-atom-forge.svg`. Carbon Builder just got its own
  hand-coded SVG built the same way the existing two were (see Done,
  above) — `build-the-atom` should get the same treatment: a small
  flat icon depicting its actual mechanic (e.g. proton/neutron/electron
  counters around a nucleus), not a generated image, matching this
  app's established card-art convention.

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

- **Reconnect the server-side anonymous-identity system, if/when real
  accounts or cross-device sync are actually being built.** Paused, not
  deleted — `lib/identity/deviceId.ts`, `lib/db/queries/students.ts`,
  `app/api/identity/route.ts`, and `components/identity/
  IdentityBootstrap.tsx` are all still present and were verified working
  (14-assertion test suite, including genuine concurrent-insert race
  recovery) before being unmounted in favor of the simpler local-only
  approach (see Done, above). To reconnect: remount
  `IdentityBootstrap` in `app/layout.tsx`, and restore the
  `resolveCurrentStudent()` calls in `app/page.tsx` / the play route's
  `page.tsx` (both currently reverted to the explicit
  `PLACEHOLDER_STUDENT_ID` / dropped prop, specifically to avoid dead
  code that looks live). When this happens, also add the DB-level
  UNIQUE constraint on `student.external_id` (no
  `supabase/migrations/*.sql` exists in this checkout to add it) — the
  application code already handles the race gracefully without it, but
  the constraint makes it provably impossible at the schema level
  rather than just handled defensively.

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

### 2026-06-29 (cont. 9) — Fixed the unlock-tracking bug, removed the answer-revealing card art, an inline per-game leaderboard, no more re-showing Quick Concepts, and reconnected identity for a real profile/XP total
Five things this round, the last one a real architecture decision —
reconnecting the previously-paused server-side identity system.

**The unlock bug — real, confirmed, fixed at the right layer.** Traced
this precisely: the previous code only recorded a mission's completion
inside `onAdvanceToNextMission` (the Next Mission BUTTON's callback) —
meaning a player who finished a mission and tapped Back instead (to
look at the map, say) never had that completion recorded at all, so
the next mission stayed locked even though it had genuinely been
earned. Completion and "the player chose to advance" are two separate
events that were wrongly conflated. Fixed by adding a new
`onMissionSucceeded` callback to `GameRuntimeProps`, fired the INSTANT
`handleEngineComplete` sees `success: true` — same moment `phase` flips
to "reflection," independent of whatever the player does next. The
unlock-recording (`setLocallyCompletedIds`) moved out of
`onAdvanceToNextMission` into this new callback; `onAdvanceToNextMission`
now ONLY handles navigation.

**Track map no longer reveals the answer.** Confirmed exactly the
concern: `MoleculeIcon` (built two rounds ago to solve "no image
needed") drew the mission's actual target structure — every atom,
every bond — on a card the player sees BEFORE attempting the mission,
which is a direct answer leak for a build-the-molecule puzzle. Replaced
with `CompoundNameBadge`, showing only the compound's name (e.g.
"Methane (CH₄)") from the mission's existing `resultLabel` field — still
real per-mission content, not a generic placeholder, but no longer
giving away how the atoms connect.

**Inline per-game leaderboard, beside the title card.** The existing
leaderboard (LeaderboardModal.tsx) was already correct but only ever
appeared after an extra tap on "View High Scores" — not actually
visible alongside the title card the way this was asked for. Built
`InlineLeaderboardPreview.tsx`: a small always-visible top-3 strip
rendered directly on `EntryScreen`'s Mission Briefing card, fetching
the exact same `/api/games/[id]/leaderboard` endpoint the modal and
HighScoreEntry already use — one source of truth, two presentations
of it. The full modal stays available via the existing button for
anyone wanting more than the top few.

**Quick Concepts no longer re-shown unnecessarily.** Confirmed via
trace: `GameRuntime`'s `phase` state ALWAYS initialized to `"snapshot"`
regardless of `hasSeenConcepts(engineType)` — that check existed and
was being written to correctly (`ConceptSnapshot.tsx` calls
`markConceptsSeen` on continue), but nothing ever READ it to skip the
screen; it only controlled whether the in-screen Skip button rendered.
Fixed by checking `hasSeenConcepts` in `phase`'s lazy initializer
itself: a player who's already seen one engine's Quick Concepts on
mission 1 now goes straight to gameplay on mission 2+, since
`GameRuntime` correctly remounts fresh per mission (confirmed the
`${runtimeResetKey}-${activeMission.id}` key from an earlier round's
fix is still in place, which is what makes this re-check happen
correctly on every mission rather than getting stuck on a stale value).

**Identity reconnected — a real architecture decision, not a silent
reversal.** Asked directly before touching anything, since this
reopens a scope question explicitly closed two rounds ago: confirmed
the server-side device-identity system (cookie + per-device student
row — `lib/identity/deviceId.ts`, `lib/db/queries/students.ts`,
`app/api/identity/route.ts`) was still fully built and tested, just
disconnected from the UI, and that `addXpToStudent` (called from every
completed attempt via `LocalDbAdapter.ts`) already worked correctly —
it only ever needed a real identity to attach to. Confirmed-yes,
reconnected: remounted `IdentityBootstrap` in `app/layout.tsx`,
restored `resolveCurrentStudent()` in both `page.tsx` files.

**Merged, not duplicated, the two name prompts.** Reconnecting
`IdentityBootstrap` would have meant TWO separate "what should we call
you" dialogs (it, and the local-only `PlayerNamePrompt` built two
rounds ago) — a real UX problem caught before shipping it. Merged into
ONE prompt: `IdentityBootstrap` now writes a chosen name to BOTH
`lib/content/localPlayerName.ts` (instant local effect, what
`HighScoreEntry.tsx` already reads) AND the server via `POST
/api/identity`, in the same submit. `PlayerNamePrompt.tsx` deleted —
fully superseded, not left as dead code. Also handles the "device
already has a local name from before this reconnection" case: pushes
that name to the server proactively on mount rather than letting the
profile start as "Anonymous" for an already-named device.

**New `/profile` page** — the 👤 avatar button in `SiteHeader.tsx`
already linked here; confirmed it was a dead link (no route existed)
before building one. Shows the device's name, real total XP (already
correct server-side, now finally attached to a real identity), total
missions completed, and a per-subject breakdown — all built on
`resolveCurrentStudent()` + `listAttemptsForStudent()`, both pre-
existing, tested infrastructure. No account, no password — the route
either resolves this device's existing identity or shows an honest
"setting up" state; there's no other path in, matching the same
"one identity per device, no login" shape already accepted for local
high scores.

Files: `GameRuntime.tsx` (onMissionSucceeded + Quick-Concepts-skip
fix), `PlayClient.tsx` (unlock recording moved to the right callback),
`TrackMapScreen.tsx` + `.module.css` (MoleculeIcon → CompoundNameBadge),
`InlineLeaderboardPreview.tsx` + `.module.css` (new),
`EntryScreen.tsx` (wired the new preview in), `IdentityBootstrap.tsx`
(merged with local name storage), `app/layout.tsx` (remounted it),
`app/page.tsx` + `app/(player)/play/[gameSlug]/page.tsx` (restored
`resolveCurrentStudent()`), `app/profile/page.tsx` +
`ProfileClient.tsx` + `.module.css` (new). Deleted:
`PlayerNamePrompt.tsx` + `.module.css` (superseded by the merge).

Verified via: a full from-scratch project TypeScript compile — caught
and fixed one real pre-existing typo in my own earlier code along the
way (`conceptPrefs.ts` referenced in comments/an import, when the real
file is `contentPrefs.ts` — confirmed by listing the actual directory,
not assumed) — zero errors after the fix; a full regression re-run of
all 73 prior logic-test assertions across the content validator,
gameplay stress test, track-map lock logic, and auto-bond formation
tests — zero failures.

Still open: the actual `/illustrations/*.png` backdrop files and
`/profile`'s visual polish (currently functional but minimal — no
edit-name affordance yet, that still only happens via the one-time
prompt) are both reasonable next passes, not blockers.

### 2026-06-29 (cont. 8) — Fixed the real drag-and-drop bug, reorganized illustration assets into their own folder, wrote a fully-specified Gemini prompt
Three things: a genuine interaction bug (drag, drop, then still needing
a click), a request to stop mixing illustration images in with the
mascot/icon folder, and a much more detailed, technically complete
image-generation prompt.

**The drag-and-drop bug — root cause found, not patched around.**
Traced this precisely rather than guessing: `DockCapsule` had BOTH
native HTML5 drag-and-drop (`draggable` + `onDragStart`) AND a separate
manual pointer-event fallback running at the same time. Native HTML5 DnD
requires the DROP TARGET to implement `dragover` (with
`preventDefault()`) and `drop` handlers to accept a drop at all —
`.emptySlot` had neither, so every real drag gesture silently failed at
the browser level every time. The fallback's own logic was ALSO broken
independently: it read a `data-drop-symbol` attribute that nothing in
the codebase ever actually set (a real dead-code mismatch, confirmed by
search, not assumed) — the only path that ever worked was a SEPARATE
subsequent click landing on a different, still-armed `window`-level
listener left over from the failed drag attempt. This is exactly why a
second click was needed.

Fixed by removing native HTML5 DnD entirely and adopting the same
pointer-tracked drag pattern `BondMatchEngine.tsx` already uses
successfully elsewhere in this codebase — pointerdown arms a drag,
pointermove updates a visual ghost following the cursor/finger AND a
live "you're hovering a valid slot" highlight, pointerup hit-tests the
release position directly against each slot's real DOM rect and places
the atom in one continuous gesture. No second click, no competing
mechanism underneath it.

Verified with REAL Playwright mouse simulation (not a mock): pressed
down on a dock capsule, moved in 8 discrete steps to a slot, released —
confirmed the atom places correctly in that one gesture. Then,
separately, reproduced the OLD native-DnD-with-no-drop-handler approach
in isolation and confirmed it genuinely fails the identical test
(`dragstart` fires, nothing else happens) — proving the diagnosis was
right, not just that the new code happens to work.

**Illustrations reorganized into their own folder.** Everything
previously lived flat in `public/mascot/` — mascot poses, hand-coded
card icons, AND full-bleed backdrop scenes, all mixed together with no
sub-organization. Created `public/illustrations/` specifically for the
full-bleed scene art (`gameEnvironments.ts`'s registry, `PrePlayShell`'s
fallback), with an explicit naming convention
(`<game-slug>-desktop.png` / `<game-slug>-mobile.png`) so the mapping
from filename to game is obvious without opening any code.
`public/mascot/` stays scoped to the mascot character and the small
SVG card icons specifically.

**A genuinely detailed Gemini prompt.** Previous prompts were
underspecified — no exact resolution, no explicit color range, no
stated relationship to the dark scrim that's ALWAYS applied on top of
every illustration in this app. Checked the real scrim CSS
(`EnvironmentBackdrop.module.css`) before writing this, rather than
guessing: it's a fixed gradient from 15% darkening at the top to 50% at
the bottom, applied identically regardless of light/dark UI theme — so
the new prompt explicitly tells the generator to compose for that (keep
important detail out of the bottom 20%, expect the result to read
darker than it looks in isolation) instead of leaving it to chance.
Added exact pixel dimensions per breakpoint, exact hex codes for the
only two colors allowed to read as saturated, explicit format/depth-of-
field/composition instructions, and a strict exclusion list — written
as a true generation brief, not prose description.

Files: `MoleculeBuilderEngine.tsx` (drag mechanism rewritten),
`MoleculeBuilderEngine.module.css` (drag-ghost + hover-highlight
styles), `gameEnvironments.ts` (paths moved to `/illustrations/`),
`PrePlayShell.tsx` (fallback path updated),
`docs/ILLUSTRATION_GUIDE.md` (new).

Verified via: a real Playwright mouse-drag simulation against the exact
new algorithm (not a mock) confirming one-gesture placement; a
companion simulation confirming the OLD approach genuinely fails the
same test, proving the diagnosis; a full from-scratch project
TypeScript compile — zero errors; and a full regression re-run of all
58 prior test assertions plus the molecule-content validator — 73
total, zero failures.

Still open: the actual `/illustrations/*.png` files still need
generating from the new prompt and dropping into place — same
outstanding item as before, just now with a real folder and a much
better prompt waiting for them.

### 2026-06-29 (cont. 7) — Removed the last image dependency, redesigned the bonding mechanic, streamlined mission flow, added unlock confirmation
Four things, the second a genuine redesign: the track map still needed
an image file; the actual bonding mechanic in Carbon Builder wasn't
clear; finishing a mission forced the player back through pregame
screens; and there was no explicit confirmation when a mission unlocked
the next one.

**Track map — no image needed, at all.** Replaced the `<img>`-based
card art (pointing at `gamePreviewArt.ts`, which depended on a
never-generated file) with a `MoleculeIcon` component: a small inline
SVG generated directly from each mission's own `slots`/`targetAtoms`/
`targetBonds` data. Every card now shows the ACTUAL molecule that
mission builds — methane's cross shape, ethane's two-carbon chain, etc.
— not a shared placeholder. Since this is genuinely better than a
single static image would have been (every card looks different and
accurate), `lib/content/gamePreviewArt.ts` was deleted entirely — it
had no remaining consumer anywhere in the codebase after this and the
earlier pregame-art removal round.

**The bonding mechanic — fully redesigned, not patched.** Per direct
feedback that the original tap-to-arm interaction (tap one atom, tap a
second, bond forms at whatever order a global selector was set to)
wasn't clear, and the explicit request for "a simple drag and drop to
fit in" with "lines that connect, then the user can connect it": every
bond the mission needs now renders as a DASHED line between its two
slot positions the instant the mission loads — the full skeleton shape
is visible from frame one, not discovered incrementally. The player's
only action is dragging atoms onto the open dots; the moment both ends
of a line have the right atom, that bond forms automatically and the
line turns solid. No tap-to-arm gesture exists anymore.

Bond-order choice (single/double/triple) is now derived PER MISSION
from that mission's real `targetBonds`, not a static game-level
setting: Easy/Medium missions have nothing to choose (every line is
single, confirmed dashed-to-solid with zero decisions), and only
Hard-tier missions (ethene, ethyne — whose real target bonds are
double/triple) introduce a choice, localized to tapping the one
specific line that needs it, not a global "whatever bonds next"
selector. This matches your explicit framing: the controls should be
fully learned before the harder chemistry concept (bond order) is
introduced in isolation, not bundled together from the start.

`wouldOverfill`'s capacity rejection — the actual "carbon can't have
more than four bonds" teaching moment — is fully preserved, just
re-triggered by "both ends now filled" instead of "second tap." None of
`moleculeBuilder.logic.ts` needed to change; `checkStructure`/
`buildFeedback`/`wouldOverfill` only ever cared about WHAT's placed, not
how it got there.

Verified via a new 15-assertion behavioral test mirroring the real
auto-bond-formation algorithm exactly, covering: bonds auto-forming the
instant both ends fill, the overfill rejection still firing correctly,
a Hard-tier double bond correctly NOT auto-forming until an order is
explicitly chosen, choosing the WRONG order still forming a (capacity-
valid) bond that Submit then correctly catches as incorrect, and a
single atom placement (isobutane's branch-point carbon) correctly
completing 4 separate lines at once.

**Mission-to-mission flow streamlined.** Confirmed `ReflectionScreen`
(Mission Complete, with its existing Next Mission button) already WAS
the "one quick transition screen" — the actual gap was what happened
after tapping it: for `trackMap` games, `onAdvanceToNextMission` used to
route to Mission Briefing/Objectives every time, forcing a click-through
of screens the player had already seen on every earlier mission of the
same game. Fixed to go straight to gameplay instead.

**Caught and fixed a real bug this change would otherwise have
introduced**: `GameRuntime` was keyed only on `runtimeResetKey`
(bumped on explicit Restart), not on the active mission. The OLD flow
got a correct state reset "for free," since routing through Briefing/
Objectives meant `GameRuntime` actually unmounted and remounted between
missions. The NEW direct-to-runtime path keeps the same component
instance alive across the mission change, which — confirmed by tracing
through `useState<Phase>("snapshot")`'s actual semantics — would have
left `GameRuntime` sitting in its leftover "reflection" phase from the
mission that just finished, never resetting to "snapshot" for the new
one. Fixed by keying `GameRuntime` on `` `${runtimeResetKey}-${activeMission.id}` ``
so any mission change forces a genuine remount regardless of which
screen-transition path caused it.

**Unlock confirmation added.** The unlock itself was already happening
correctly (`locallyCompletedIds` gets the just-finished mission added),
but nothing told the player — they'd only discover a new mission was
available by going back to the map. Added an explicit `🔓 "[Mission
Title]" is now unlocked!` line to `reviewSuccessLines` for `trackMap`
games with a next mission, so the unlock is a visible, named
confirmation on Mission Complete, not a silent state change.

Files: `MoleculeBuilderEngine.tsx` (rewritten), `MoleculeBuilderEngine.
module.css`, `TrackMapScreen.tsx` (MoleculeIcon added, img removed),
`TrackMapScreen.module.css`, `PlayClient.tsx`, `gameCardMeta.ts` (stale
comment cleanup), `lib/content/gamePreviewArt.ts` (deleted).

Verified via: the new 15-assertion auto-bond behavioral test; rendered
visual mocks of both the dot-to-dot mechanic (showing 2 formed + 2 open
bonds, confirming the dashed/solid distinction reads clearly even as a
static image) and the new inline track-map card icons (confirming
methane and ethane render as genuinely different, recognizable shapes
with zero image files); a full regression re-run of all 58 prior test
assertions across the content validator, gameplay stress test, and
track-map lock logic — zero failures; and a full from-scratch project
TypeScript compile — zero errors.

### 2026-06-29 (cont. 6) — Removed pregame art, real Carbon Builder card icon, and a genuine gameplay layout/visibility fix
Three things: remove the pregame preview-art feature added last round
(it wasn't what was wanted), give Carbon Builder a real worlds-list card
icon the same way Atom Forge/Element Hunter already have one (hand-built
SVG, no image generation), and fix real, confirmed gameplay problems —
some atoms unreadable, and the build surface not using available
vertical space.

**Removed**: `lib/content/gamePreviewArt.ts`'s usage inside
`EntryScreen.tsx` (Mission Briefing) and `MissionObjectivesScreen.tsx`
(Mission Objectives) — both screens reverted to their prior state (the
periodic-table glyph for particle-assembly missions stays; nothing
replaces it for other games, per direct instruction). The registry
file itself stays, since `TrackMapScreen.tsx`'s card deck (a different,
still-wanted surface) also uses it for its card faces.

**Real card art, not generated**: built `public/mascot/card-carbon-
builder.svg` — hand-coded SVG depicting methane (one carbon, four
hydrogens), the game's actual first mission, using the real atom colors
from `atomRoster.ts`. Same construction approach as the existing
`card-atom-forge.svg`/`card-element-hunter.svg` (flat, iconographic, no
image-generation pipeline), per direct instruction. Wired into
`gameCardMeta.ts`, replacing the placeholder PNG path that was never
actually generated.

**The gameplay bugs — both confirmed numerically/visually before
fixing, not guessed at:**

1. *"Some elements are not visible"*: computed real WCAG contrast
   ratios for the atom chip's hardcoded white text against each atom's
   actual color. Hydrogen scored 1.39:1, Chlorine 1.57:1, Oxygen
   2.65:1 — all fail even the lenient 3:1 large-text minimum; only
   Carbon barely passed. Fixed by switching to a dark ink text color
   universally — rechecked, it wins for every atom in the roster,
   comfortably clearing the full 4.5:1 normal-text threshold, including
   during the red "reject" flash animation (also rechecked: 4.89:1).

2. *"The atom elements are scrollable when there's a lot of space
   down — make use of the space down"*: checked `TileMatchEngine`'s own
   CSS history first, since it documents a previous attempt at exactly
   this kind of fix (`min-height: 50vh` on its panel) that was tried and
   explicitly REVERTED after a real screenshot showed an unintentional-
   looking dead gap at the top rather than the content actually growing.
   Followed that established lesson instead of repeating the mistake:
   added `flex: 1; min-height: 0` to `.buildSurface` (so it genuinely
   grows to fill GameplayShell's available vertical space — the
   container-side fix) AND increased slot/atom-chip sizing from 72px/
   60px to 96px/80px on mobile, 108px/88px on desktop (closer to
   tile-match's own established ~90-115px tile scale) — content that's
   actually bigger, not a bigger empty box around small content.

   **Found and fixed a real pre-existing bug while doing this**:
   `BondLines`' bond-line-drawing logic hardcoded `CELL_SIZE = 72` in
   JS, completely disconnected from the CSS — meaning bond lines were
   ALREADY silently misaligned at the existing >=600px breakpoint (CSS
   used 84px there) even before this round's sizing change, and would
   have been wrong again with any new hardcoded number. Fixed properly:
   `BondLines` now draws in grid-cell units via an SVG `viewBox` sized
   to the actual grid dimensions, so bond lines stay correctly
   positioned at any breakpoint automatically, with no pixel constant
   to ever fall out of sync with CSS again.

Files: `EntryScreen.tsx` + `.module.css`,
`MissionObjectivesScreen.tsx` + `.module.css`, `PlayClient.tsx`,
`gameCardMeta.ts`, `public/mascot/card-carbon-builder.svg` (new),
`MoleculeBuilderEngine.module.css`, `MoleculeBuilderEngine.tsx`.

Verified via: WCAG contrast ratio calculations for all 4 atoms against
both white and dark text (every atom now passes 4.5:1+); a rendered
visual check of the new SVG card art; rendered mock-ups of both a small
molecule (methane, confirming it now centers and fills available
vertical space instead of floating/scrolling) and a large one (pentane,
confirming the overflow safety net still correctly engages only when a
molecule is genuinely too wide for the screen); and a full from-scratch
project TypeScript compile — zero errors.

Still open: `build-the-atom` still reuses Atom Forge's placeholder card
art (same gap flagged in an earlier round) — not fixed this round since
it wasn't part of this request; tracked in Planned.

### 2026-06-29 (cont. 5) — Fixed the Carbon Builder crash, surfaced a sibling bug, added real preview art, swipeable track map, header bar in Quick Concepts, and a Gemini-optimized art prompt
Five things this round: a real crash, two screens showing generic
imagery instead of per-game art, a missing header bar on Quick
Concepts, a vertical list that needed to become a swipeable card deck,
and a request for a much better, Gemini-specific backdrop prompt.

**The crash — root cause.** `MoleculeBuilderEngine.tsx` crashed with
"Cannot read properties of undefined (reading 'map')" on
`mission.dockSymbols`. Traced this to a real type/shape mismatch: the
engine's config type flattened `MoleculeBuilderMissionPayload` directly
onto `mission` (`mission: MoleculeBuilderMissionPayload & {id, title,
xpReward}`), but `GameRuntime.tsx`'s actual `GameRuntimeMission` shape
keeps mission content NESTED under `mission.payload` — confirmed by
checking `bond-match`'s `resolveSharedConfig()`, which correctly reads
`config.mission.payload`, the established working convention. Fixed by
changing `MoleculeBuilderConfig`'s mission type to match that nesting
and updating every access point in the engine component
(`mission.dockSymbols` → `payload.dockSymbols`, etc., via a single
`const payload = mission.payload` destructure). **Also discovered, while
tracing this, that `particle-assembly` has the EXACT SAME latent bug**
(`ParticleAssemblyEngine.tsx` accesses `mission.target` directly, the
same flattened-access mistake) — not fixed this round (out of scope,
not reported broken), but flagged here as a real pre-existing issue
this investigation surfaced, since it would crash Build the Atom
identically the moment its config object takes this exact path.

**Generic preview imagery — Mission Briefing & Mission Objectives.**
Neither screen showed any real per-game visual for non-proton-target
missions (Mission Briefing's only "preview" was a periodic-table glyph
that only ever rendered when a mission's payload had a `target.proton`
field — true for particle-assembly missions, never true for Carbon
Builder). Added a new registry, `lib/content/gamePreviewArt.ts` — a
THIRD per-game image registry alongside the existing backdrop
(`gameEnvironments.ts`) and card-thumbnail (`gameCardMeta.ts`)
registries, since each serves a genuinely different aspect ratio and
rendering context. Wired into `EntryScreen.tsx` (shown when no element
glyph applies — the glyph still wins when present, since it's more
specific) and `MissionObjectivesScreen.tsx` (new optional `gameSlug`
prop). Also pointed Carbon Builder's homepage/worlds card thumbnail at
this same new asset instead of continuing to reuse Atom Forge's
placeholder.

**Missing header bar in Quick Concepts.** Confirmed via a direct code
trace that `ConceptSnapshot.tsx` (Quick Concepts) is mounted directly
by `GameRuntime.tsx`, a completely separate render path from
`PlayClient.tsx`'s `PrePlayShell`-wrapped screens — which is why it
never got the title/subject/back bar every OTHER pre-play screen shows.
Added `gameTitle`/`subject`/`onBack`/`backLabel` props to
`ConceptSnapshotProps`, rendering the same `BackButton`+`MissionTopBar`
pair every other screen uses. Threaded `gameTitle`/`subject` through as
new `GameRuntimeProps`, and added a genuinely correct `onBackFromConcepts`
callback (distinct from `onBackToHome`) that returns to the Mission
Objectives screen — the literal previous step in the flow — rather than
skipping straight to /worlds, matching every other screen's "back goes
one step back" convention. The post-mission "reviewingConcepts" revisit
(reopened from Reflection) deliberately gets NO back button, since
there's nothing equivalent to go back to once a mission is already
complete.

**Swipeable track map.** Rewrote `TrackMapScreen.tsx` from a vertical
list of inline-styled rows into a horizontal, swipeable card deck using
native CSS scroll-snap (no new dependency — checked, this app has no
existing carousel library) plus a real `TrackMapScreen.module.css` (the
inline-style approach was already flagged as a known follow-up from an
earlier round). Per your explicit decision, locked cards stay VISIBLE
in the deck, dimmed with a 🔒 badge, rather than being hidden until
reached — the player can swipe through and see the whole path before
earning access to later steps. Added a dot progress indicator (matching
`ConceptSnapshot`'s existing dot pattern) driven by an
`IntersectionObserver` tracking which card is currently centered.

**Gemini-optimized backdrop prompt.** Rewrote both prompt pairs in
`docs/BACKDROP_ART_PROMPTS.md` specifically for Gemini's image
generation rather than a generic prompt — single continuous descriptive
paragraphs (Gemini follows narrative scene description more reliably
than keyword lists), with the crop-safety requirement and the
not-for-children requirement both folded directly into the scene
description (camera angle/framing, "editorial science-magazine
illustration" reference) rather than appended as separate rules, since
compositional instructions framed as part of the scene get followed
more reliably than instructions that read like bolted-on metadata.

Files: `moleculeBuilder.config.ts`, `MoleculeBuilderEngine.tsx`,
`gamePreviewArt.ts` (new), `EntryScreen.tsx` + `.module.css`,
`MissionObjectivesScreen.tsx` + `.module.css`, `gameCardMeta.ts`,
`ConceptSnapshot.tsx` + `.module.css`, `GameRuntime.tsx`,
`PlayClient.tsx`, `TrackMapScreen.tsx` (rewritten),
`TrackMapScreen.module.css` (new), `docs/BACKDROP_ART_PROMPTS.md`
(rewritten).

Verified via: a from-scratch full-project TypeScript compile after each
major change in this round (the crash fix, the preview-art wiring, and
the full track-map rewrite) — zero errors throughout, confirmed against
the real `GameplayShell`/`PrePlayShell`/`BackButton`/`MissionTopBar`
modules, not stubs.

Still open: `particle-assembly`'s identical latent mission-payload bug
(see above) is not fixed — flagged as a real, separate follow-up. The
actual preview-art image files (`/mascot/preview-*.png`) still need to
be generated and dropped in, same as the backdrop images from the
previous round.

### 2026-06-29 (cont. 4) — Found it: Carbon Builder was never actually inserted
You shared your live `game` table — confirmed it has exactly 2 rows
(`atom-forge`, `element-hunter`). Carbon Builder isn't hidden by
`is_active` or any filter; the insert never landed in Supabase at all.

Built a complete, schema-validated SQL seed script
(`docs/seed-carbon-builder.sql`) rather than hand-typing JSON and hoping
— every mission payload and the shared_config were generated directly
from the real code (`atomRoster.ts`, `carbonBuilderMissions.ts`) and
verified against the real Zod schemas before being written into the
SQL, then double-checked byte-for-byte identical between the generated
JSON and what ended up in the file (a Python diff pass, not just a
visual read). All 13 embedded JSON blobs (shared_config + snapshot + 11
mission payloads) independently confirmed as syntactically valid JSON.

The script uses a single CTE so the game's real id flows automatically
into every mission insert — no manual id copy/paste — and includes an
explicit safety check to run first (confirms no carbon-builder row
already exists) plus a note about `progression_mode` possibly not
existing as a column yet on the live table (with the exact `alter
table` to add it, or how to omit it and accept the old inferred
level-select behavior instead).

While cross-checking the live dump against the code, also confirmed
(not guessed) that `element-hunter`'s stored `shared_config.tiers` is
the OLD pre-difficulty-fix shape (3 tiers, atomic_number/group/valence
only, no period/electron_number/mass_number) — but verified this is
harmless: `difficultyModifiers.ts`'s EASY/MEDIUM/HARD entries fully
override `tiers` at runtime regardless of what's stored, so the live
row doesn't need re-seeding for the difficulty fix to work correctly.
Also confirmed `snapshot.lines` (the old Quick Concepts shape, not the
newer `snapshot.cards` shape) safely falls through to
`quickConcepts.ts`'s hardcoded fallback rather than crashing — verified
against `GameRuntime.tsx`'s actual `Array.isArray(snapshot?.cards)`
check, not assumed.

Files: `docs/seed-carbon-builder.sql` (new). No application code
changes — this was a data-only gap, not a code bug.

**Correction after you ran it**: `progression_mode` errored with
"column does not exist," confirming it wasn't on your live `game`
table. Added `alter table game add column if not exists
progression_mode text;` to the top of the script — and, since
`learning_goal` (used by the mission INSERT) was flagged in
`types/db.ts` with the identical "requires a migration, never
confirmed against a real database" caveat, added its `alter table`
preemptively too, rather than letting you hit a second error right
after fixing the first. Both use `if not exists` so the script is safe
to run regardless of which columns your table is actually missing.
Re-verified all 13 embedded JSON blobs are still valid after this edit.

**Second correction**: the mission insert then errored with `column
"difficulty" is of type difficulty but expression is of type text`.
Root cause: the `(values ...) as m(mission_key, title, difficulty, ...)`
construct declares column NAMES only, with no explicit types, so
Postgres infers each column's type purely from the literal values
across all 11 rows — landing on plain `text` for difficulty,
independent of what `mission.difficulty`'s real column type actually is
(a genuine Postgres enum, confirmed by the error message itself, which
names the type as `difficulty`). Fixed by adding an explicit
`m.difficulty::difficulty` cast at the point it's selected out of that
derived table. Checked whether this same risk applied anywhere else in
the script: the `game` row's INSERT uses a plain `INSERT ... VALUES
(...)` (no derived table), so Postgres infers those literals directly
against `game`'s real column types with no intermediate `text` step —
confirmed safe, not just assumed. The other two columns in the
mission derived table that go through a cast (`payload::jsonb`) were
already explicit; `sequence_index`/`xp_reward` are plain integers
matching plain integer columns, no enum risk there.

### 2026-06-29 (cont. 3) — Diagnosed a new 404, art prompts corrected for the real audience
Three reports: a new 404 on the leaderboard fetch (different from the
earlier webpack crash, now that the route exists), Carbon Builder not
showing up anywhere after being seeded into the DB, and the backdrop art
prompts reading too young for the actual audience (high school, not
young children).

**The leaderboard 404 — diagnosis, not yet independently confirmed.**
The route fix from the prior session (moving `leaderboard.ts` to
`leaderboard/route.ts`) is correctly in place in this codebase. A 404
specifically (as opposed to the earlier cryptic webpack crash) most
likely means the running app hasn't actually had that fix applied yet —
if the old misplaced file is still present alongside or instead of the
new one, the endpoint still won't resolve. Re-checked the full
`app/api` tree again to confirm no other misplaced route files exist
anywhere else in this codebase.

**Carbon Builder missing from every game list — root cause found via
code trace, pending your DB confirmation.** Traced every code path that
could hide a seeded game (`listGames()`'s query, `/worlds`'s grouping
logic, the homepage's card-art lookup) and confirmed all of them either
show a game or fail loudly/visibly — none of them silently filter
something out except one: `listGames()` filters `eq("is_active", true)`.
If Carbon Builder's seeded `game` row doesn't have `is_active` set to
literal `true` (null, false, or a string `"true"` would all be
silently excluded with zero error), it will never appear on the
homepage or `/worlds`, with no crash to point at it. Sent you the exact
SQL to check (`select slug, is_active, engine_type, subject from game
where slug = 'carbon-builder'`) rather than guessing further without
visibility into the live Supabase data — also flagged `engine_type`
must be exactly `"molecule-builder"` (a typo there wouldn't hide the
game from lists, but would crash the moment someone tries to play it).

**Backdrop art prompts rewritten for the real audience.** Original
prompts in `docs/BACKDROP_ART_PROMPTS.md` skewed toward a young-children
register — "candy-bright" colors, "toy block" framing, cartoon-mascot
energy — appropriate for an elementary app, wrong for this one's actual
high-school audience. Rewrote both prompt pairs (Element Hunter,
Carbon Builder; desktop + mobile each) around a "clean modern scientific
illustration / science museum exhibit" framing instead — same purple/
gold accent palette and the same lower-two-thirds/croppable-top
technical constraints as before, but explicit instructions against
cartoon mascots, candy saturation, and "toy" framing, and an explicit
note that this app's actual display font ("Baloo 2" falling back to
"Space Grotesk," a modern geometric sans, not a bubbly kids'-app
typeface) supports a more grown-up register than the original prompts
assumed. Added an explicit "would a 16-year-old think this looks like
it's for them" audience check to the generation notes, alongside the
existing style-consistency check against Atom Forge's backdrop.

Files: `docs/BACKDROP_ART_PROMPTS.md` (rewritten). No code changes this
round — the leaderboard/Carbon-Builder issues are pending your
DB-side/deployment confirmation before further code action, if any
turns out to be needed.

### 2026-06-29 (cont. 2) — Fixed the leaderboard crash; scoped identity back down to local-only
You hit a real crash clicking the leaderboard ("Cannot read properties
of undefined (reading 'call')") and, separately, corrected the scope
from last round: no accounts, no server-side identity — just per-game
high scores that actually work, with a name that's remembered locally
so it doesn't need retyping every time. Both addressed.

**The crash — root cause.** `app/api/games/[id]/leaderboard.ts` existed
as a plain file sitting inside the `[id]` folder, but Next.js's App
Router only ever recognizes a route from a file literally named
`route.ts`. That endpoint never existed as a real route at all — every
fetch to it resolved to nothing meaningful, which is what produced the
cryptic webpack error rather than a clean 404. Fixed by moving it to
the correct location: `app/api/games/[id]/leaderboard/route.ts`. Scanned
the entire `app/api` tree afterward to confirm this was the only
misplaced file.

**Scope correction — what changed back.** Last round built a full
server-side anonymous-identity system (device cookie, get-or-create
student rows) aimed at a global, cross-device leaderboard. Per explicit
follow-up: that's bigger than what's needed right now — the actual ask
is LOCAL per-game high scores (already mostly working via
`lib/content/localHighScores.ts`) with a name that's remembered across
games/sessions on the same device, no account, no cookie. So:
- **`IdentityBootstrap.tsx`** (the component that called `/api/identity`
  to mint the server-side cookie) was unmounted from `app/layout.tsx`
  and replaced with a new, purely local **`PlayerNamePrompt.tsx`** — same
  one-time "what should we call you" UI, but it just writes to
  localStorage, no server round-trip at all.
- New **`lib/content/localPlayerName.ts`** — `getLocalPlayerName` /
  `setLocalPlayerName` (capped at 20 chars, trimmed, ignores
  whitespace-only saves so they can't clobber a real saved name) plus a
  separate seen-flag so skipping the prompt doesn't make it reappear
  every visit.
- **`HighScoreEntry.tsx`** now pre-fills its name input from
  `getLocalPlayerName()` instead of always starting blank, and calls
  `setLocalPlayerName()` on every save — so a player who skips the
  one-time prompt but types a real name into their first high-score box
  still gets it remembered from then on, on every other game too.
- **`app/page.tsx`** and the play route's **`page.tsx`** had their calls
  into `resolveCurrentStudent()` removed/reverted — with
  `IdentityBootstrap` no longer mounted, that cookie is never minted
  anymore, so those calls would have silently always resolved to
  nothing forever: dead code that looks live. Reverted the play route
  back to its original explicit `PLACEHOLDER_STUDENT_ID`, and dropped
  the now-always-`undefined` `currentStudentXp` prop from the homepage
  fetch entirely, rather than leaving an unreachable call sitting there.

**What did NOT change, per explicit decision**: the DB-backed global
leaderboard SECTION inside `HighScoreEntry.tsx`/`LeaderboardModal.tsx`
stays visible and is not being actively maintained right now — but since
its crash was the misplaced-route-file bug above, fixing that crash also
makes this section work correctly again as a side effect of the route
fix, not as new scope. The underlying server-side identity system
(`lib/identity/deviceId.ts`, `lib/db/queries/students.ts`,
`app/api/identity/route.ts`) is untouched and still fully functional —
just not currently wired into the active UI. Reconnect it (and remount
`IdentityBootstrap` or an equivalent) if/when a real account or
cross-device system actually gets built.

Verified via: a new 10-assertion test for `localPlayerName.ts`'s
save/overwrite/trim/cap/whitespace-guard behavior and the
seen-flag/name independence; full from-scratch project TypeScript
compile — zero errors; regression re-run of all three earlier test
suites (Carbon Builder content validation, gameplay stress test,
track-map lock logic) — all still passing, confirming nothing else broke.

Files: moved `app/api/games/[id]/leaderboard.ts` →
`app/api/games/[id]/leaderboard/route.ts`; new
`lib/content/localPlayerName.ts`, `components/identity/
PlayerNamePrompt.tsx` + `.module.css`; modified `app/layout.tsx`,
`app/page.tsx`, `app/(player)/play/[gameSlug]/page.tsx`,
`components/runtime/HighScoreEntry.tsx`.

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
