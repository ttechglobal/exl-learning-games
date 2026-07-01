# EXL Game Design Specification — Master Template

**Use this for every new game, before any code or content gets written.**
Copy this file, rename it to the game's slug (e.g. `mirror-lab.md`), and
fill in every section. It replaces the two earlier templates
(`NEW_GAME_SPEC_TEMPLATE.md` and `GAME_DESIGN_SPEC_TEMPLATE.md`) — both are
superseded by this one; archive them rather than keeping three documents
that can drift out of sync with each other.

**Why this template exists.** Every section below maps to something the
platform's actual code requires to render and run a game, traced directly
against `src/`: the engine registry, `AttemptResult`, `GameplayShell`,
`ConceptSnapshot`, `lib/content/gameEnvironments.ts`, and so on. This isn't
generic game-design boilerplate — skipping a section means a real gap
somewhere in the running app, not just an incomplete document.

**Sections marked (Required)** must be filled in before a build starts.
**Sections marked (Optional — has fallback)** can be skipped for a first
prototype, but the platform's fallback is a visibly unfinished state (a
generic gradient, placeholder card art, a one-line snapshot) — fine for an
internal test, not for anything shown to real students.

**Before filling this out**, read `docs/game-specification-standards.md`
in full. That document is the checklist this spec gets graded against —
a filled-in template that violates something there isn't ready to build,
flag the conflict instead of quietly shipping it.

---

## 0. Engine decision (Required)

This is the single most important judgment call in the whole document —
get it wrong and everything downstream (content shape, mobile risk,
build estimate) is wrong too.

**An engine is the mechanic itself**: what's on screen, how the player
interacts, and — critically — **the one moment that gets checked** to
decide success or failure. Two games can look completely different
(different subject, different art, different content) and still be the
*same engine* if that one checked moment has the same shape. Don't
request a new engine because a game "feels different"; request one
because the moment of truth is structurally different. This is a shape
question, not a flavor question.

### Engines that exist today

| Engine | The moment of truth | Example |
|---|---|---|
| `tile-match` | A clue appears; the player's tap on a tile is checked against the clue's match rule; loops many rounds in one timed session | Element Hunter |
| `bond-match` | The player drops one dragged item onto another; the drop is checked against the current mission's valid pair | Atom Forge |
| `particle-assembly` | The player presses Submit; the full set of added units is checked against a target composition | Build the Atom |
| `molecule-builder` | The player presses Submit; every filled slot + bond count is checked against the target structure | Carbon Builder |

### Engine fit check — answer this before naming a mechanic

1. **Name the exact moment of truth in one sentence.** Not "the player
   plays the level" — the one input that gets checked: a drop, a release,
   a tap, a submit press. If you can't name one single moment, the game
   concept itself may need tightening before engine-fit can even be
   judged.
2. **Compare that sentence against each row above.** If it matches one
   (even loosely — different subject, same shape), reuse that engine.
   Reusing an engine means this spec is content-only — no new component,
   no new schema, no registry change, dramatically lower build cost and
   risk.
3. **If none match**, this is a new-engine project. That's a legitimate
   and sometimes necessary outcome — but it's a materially bigger lift
   (new Zod schema, new round/check logic, a new React component, one
   line in `src/engines/registry.ts`, and usually a from-scratch mobile
   performance pass). Say so explicitly here, and write the mechanic
   description in Section 3 as the actual engineering brief — detailed
   enough that an engineer could build the engine from it without asking
   you follow-up questions about how a round resolves.

- [ ] Reuses an existing engine: ______________________
- [ ] Needs a new engine (Section 3 must fully specify the mechanic)

### If this is a new engine: the four questions that must be answered here, not discovered during build

These come directly from real gaps found reviewing a recent new-engine
proposal (Mirror Lab) — each one is a place that design doc skipped past,
and skipping any one of them produces either a broken mission type or a
silent analytics gap once built.

1. **What exactly gets checked, and when?** Walk through the player's
   actual input sequence and name the precise check. "The player predicts,
   then runs the experiment, then the result is compared to the
   prediction" is still too vague — compared *how*? Exact match on every
   selected property? Partial credit if 2 of 3 predicted properties are
   right? Decide the comparison rule now.
2. **Does every mission TYPE in this game have a real win/fail condition?**
   If the design includes anything like a "free exploration" or "no
   objective, just look around" mode, decide explicitly what `success`
   reports for it (see Section 4's AttemptResult note) — "the player
   interacted with the control for N seconds" is a defensible answer,
   "there is no answer" is not, because it leaves a hole in
   `AttemptResult` that breaks mastery scoring for that mission type.
3. **What does the platform's standard wrong-answer feedback ACTUALLY
   look like for this mechanic?** Every game gets "gentle shake + mascot
   encourage + hint, no hard penalty" by default (Section 6) — but a
   prediction-based mechanic's "wrong answer" might be a wrong guess
   before the experiment runs, not a wrong final state. Name the specific
   moment the gentle-failure feedback fires.
4. **Can the core interaction run smoothly on a low-end Android phone?**
   If the mechanic involves continuous recalculation while dragging
   (physics simulation, ray tracing, live geometry), this needs a
   technical spike — confirm the frame rate on representative low-end
   hardware (or even just Chrome DevTools' CPU throttling) BEFORE writing
   the full spec's content sections. A mechanic that's silky on a
   developer's laptop and chugs on a ₦40,000 Android phone is the single
   most expensive mistake to discover after content is already written,
   since by then missions, art, and copy all assume the interaction
   works as designed.

---

## 1. What the game is about (Required)

- **Slug** (lowercase-kebab-case — becomes the URL and every content
  lookup key, e.g. `mirror-lab`): ______________________
- **Title** (shown to players): ______________________
- **Subject** (`chemistry` / `mathematics` / `physics` / `biology`, or a
  new one — see Section 9 if new): ______________________
- **Topic ID** (slug matching the real ExamPrep curriculum — see the
  non-negotiable data contract note below): ______________________
- **Subtopic ID** (optional, slug): ______________________
- **One-sentence pitch** — what does the player actually DO, not what
  they learn: ______________________
- **What concept does this reinforce?** The actual classroom learning
  objective — one sentence describing what the student can DO afterward,
  not just "knows about X." Be specific, not "physics basics."
  ______________________
- **Why does the chosen mechanic teach that concept well?** This is the
  sanity-check sentence a reviewer uses before content gets written — if
  the mechanic and the concept don't actually connect, this is where that
  gets caught.
  ______________________
- **Why NOT a quiz?** One sentence on what this mechanic does that
  multiple-choice couldn't. If you can't answer this, the concept may
  still be quiz-shaped underneath a game skin — see
  `docs/Game_Philosophy`'s explicit instruction against exactly that.
  ______________________

**Non-negotiable data contract**: every scorable unit (mission, round,
experiment) must resolve to a real topic/subtopic ID from the actual
curriculum, never a game-invented category — mastery data has to mean
something to the main platform, not just to this game.

---

## 2. Student fantasy & world framing (Required)

This is the framing that makes a mechanic feel like a game instead of an
exercise — fill it in with real specificity, not "you are a student
learning X."

- **Who is the player, in-world?** (e.g. "the newest scientist at the
  International Optics Research Lab," "an Element Engineer repairing a
  forging machine"): ______________________
- **What's the daily/session framing?** (e.g. "every day the lab receives
  a new optical experiment"): ______________________
- **Mission Briefing flavor line** — one narrative sentence shown at the
  top of the pre-play screen (`lib/content/missionBriefing.ts`).
  Excitement, not explanation — answers *why am I here*, not *what are
  the rules*. Real example: *"Welcome, Scientist. The laboratory's
  element database has become disorganised — bond the right atoms
  together before the system fails."*
  ______________________
  *(If skipped, falls back to: "Welcome back. Your next challenge is
  ready — complete it to earn XP and keep climbing." — generic, fine for
  a prototype, not for anything shipped.)*

---

## 3. Core gameplay mechanic (Required)

### If reusing an existing engine

- **Core interaction** (the actual physical action — drag, tap, drop,
  type): ______________________
- **Content shape needed** — pick the block matching the engine chosen in
  Section 0 and fill it in:

  **`tile-match`**: item/clue pool (every property a clue can test — list
  them, e.g. atomic number, valence, period for Element Hunter — a
  non-chemistry tile-match game needs its own equivalent set), tile
  count, session length defaults.

  **`bond-match`**: item pool (every draggable item), pairs/missions
  (each needs a key, display name, category/bond-type, and the actual
  valid pair) OR factory mode (same pair data plus quantities and a
  session duration).

  **`particle-assembly`**: generators (each countable unit — id, label,
  particle label, color, panel), target compositions (one per mission,
  exact counts + optional result label), feedback rules (mismatch
  message, optional "you actually built X" lookup table).

  **`molecule-builder`**: atom roster (symbol, max bond count, color),
  missions (target structure as named slots with row/col position, bond
  type per connection, dock contents).

### If this is a new engine

Write the FULL mechanic specification here — this becomes both the
content schema and the engineering brief:

- **Step-by-step interaction flow**, numbered, from mission start to
  mission end. Not a mood description — the literal sequence of screens/
  states/inputs.
- **The exact moment of truth** (repeat your one-sentence answer from
  Section 0 here, then expand it): what specific input, checked against
  what specific rule, produces success vs. not-yet-correct vs. failure.
- **Real-time vs. checked-on-submit?** Does feedback happen continuously
  as the player manipulates something (e.g. "move the object, the image
  updates live"), or only when they commit an action (drop, submit
  button)? This single decision drives most of the technical risk — see
  Section 0, question 4.
- **State that needs to persist across one mission** (e.g. "current
  prediction selections," "object position," "selected mirror type") —
  list every piece of state the engine component needs to track.
- **What does this mechanic generalize to later?** (Per the architecture
  doc's engine-vs-content judgment: if this engine could plausibly power
  2-3 future games beyond this one, name them — that's useful evidence
  it's a real engine investment, not a one-off.)
  ______________________

### Win / lose / scoring (Required — answer ALL three even if the answer is "no fail state")

- **Win condition**: what ends a mission/round successfully, exactly.
  ______________________
- **Lose condition, if any**: some engines (`particle-assembly`) have no
  fail state at all, only "not yet correct" — that's a legitimate answer,
  but say so explicitly rather than leaving it implicit.
  ______________________
- **Scoring method**: XP-only completion? Time/accuracy-weighted
  continuous score (0-1)? Per `types/result.ts`'s `AttemptResult`,
  exactly one of `success` (boolean) or `score` (0-1 float) should be the
  meaningful field for this mechanic — decide which one now.
  ______________________
- **`attemptsBeforeSuccess`**: does this mechanic support retrying within
  one mission? If so, this free difficulty signal should be reported —
  confirm it's part of the raw outcome the engine returns.
- **For any mission type with no natural pass/fail** (e.g. a pure
  "explore, no objective" mode): per Section 0's new-engine question 2,
  state explicitly what gets reported for `success`/`score` so this
  mission type doesn't silently break mastery scoring.

### Hint system (Required)

- **On by default, or only after N wrong attempts, or off entirely?**
  Default platform pattern (Element Hunter): hint appears only after one
  wrong attempt — fast play stays fast, struggling play gets help.
  ______________________
- **What does the hint actually reveal?** Hints must TEACH, not solve —
  e.g. bond-match's hint reveals the bond TYPE, never which two atoms to
  drag. Name the equivalent partial-reveal for this mechanic.
  ______________________

---

## 4. Difficulty & progression (Optional — has fallback, strongly recommended)

Per the platform's core design principle: **difficulty must change actual
gameplay or content, not just speed up a timer.** This was a real,
fixed bug in Element Hunter — be deliberate here, not by-default.

State explicitly which of these applies, and don't settle for "two
levels that play identically with different labels":

- **Content gets harder** (harder/more items, same mechanic):
  ______________________
- **Mechanic gets harder** (a genuinely new interaction introduced
  partway — e.g. Atom Forge's covalent-bond animation arriving at Level
  2): ______________________
- **Scaffolding gets removed** (visual aids/labels hidden progressively —
  the correct difficulty model for any mechanic built around prediction
  or spatial reasoning, e.g. "show every label → hide the rays → hide
  everything except the bare apparatus"): ______________________

For each tier actually used, specify what's different in content, not
just numbers:

| Tier | What's actually different | XP |
|---|---|---|
| Easy | | |
| Medium | | |
| Hard | | |

**Timed vs. untimed** — decide deliberately: untimed fits mastery-style
learning; timed fits arcade/recall-speed games. Mixing both within one
game needs a clear stated reason.
- [ ] Untimed
- [ ] Timed — duration: ______
- [ ] Mixed — reason: ______________________

If this section is skipped entirely, the difficulty picker screen won't
show for this game (`engineSupportsDifficultyChoice` returns false for
any engine with no modifiers defined) — fine for a level-based game,
wrong for a session-based one.

---

## 5. Quick Concepts snapshot (Optional — has fallback, write this properly)

2-4 titled cards shown right before play, revisitable afterward via "View
Concept Summary." **Each card is ONE idea with one short concrete
example — not a paragraph.** Real reference (Atom Forge):

1. **Ionic Bonds** — "A metal GIVES an electron to a non-metal."
2. **Covalent Bonds** — "Two non-metals SHARE electrons instead."
3. **How to Play** — "Drag two atoms close together to bond them."

Fill in for this game — one card per real mechanic concept the game
actually tests, plus a How to Play card:

| Card title | Body (one idea + one concrete example) |
|---|---|
| | |
| | |
| | |
| How to Play | |

If skipped, falls back to one generic line ("Get ready — your mission is
about to begin") — acceptable for an internal prototype only.

---

## 6. Feedback & tone rules (Required — fill in even though most of this has a platform default)

Per `docs/game-specification-standards.md` Section 5, these are binding
for every game, not optional polish:

- **No punishment, only guidance.** Wrong answers get a hint and a gentle
  consequence (lost time, reset combo) — never a harsh fail state, never
  punishment-framed copy ("System Warning" was rejected platform-wide in
  favor of "Almost there" for exactly this reason).
- **On success**: default payoff is burst + reward card + mascot
  celebrate + XP. Only specify below if this game wants something
  different (e.g. Carbon Builder's molecule-specific success copy naming
  the actual atom/bond count):
  ______________________
- **On failure / wrong answer**: default is gentle shake + mascot
  encourage + hint, no hard penalty. Only specify below if this game
  needs a real penalty (e.g. "lose a life," "lose time") — name it:
  ______________________
- **Mascot appearance**: idle/greeting at entry, celebrate on success,
  encourage on failure — same character across every game
  (`motion/Mascot.tsx`, three poses total). Confirm this game uses the
  existing three poses; flag here only if a genuinely new pose is needed
  and explain why `encourage` doesn't already cover it.
- **Wrong-answer copy should be specific, not generic** where the
  mechanic allows it — e.g. naming the actual atom and its real
  current/max bond count, not "Try again."
  ______________________

---

## 7. Session structure (Required — standard bookends apply to every game)

- Every game gets a Concept Snapshot before play (Section 5) and the
  standard Reflection screen after — these are the Learn → Play → Reflect
  → Practice → Improve loop from the original product brief, not
  optional UI.
- **Does this game need anything beyond the standard Reflection screen?**
  A game-specific addition (like Build the Atom's Periodic Table reveal)
  is encouraged when it reinforces THAT game's specific concept — but it
  must be additive via the Reflection screen's `extraContent` slot, never
  a replacement for the standard screen.
  ______________________
- **Mission Objectives checklist** — 3-4 short check-mark lines, keyed by
  ENGINE not by individual mission (`lib/content/missionObjectives.ts`).
  If reusing an existing engine, this game inherits that engine's
  objectives for free — only fill in below if this specific game needs an
  override or addition (e.g. "Finish before the timer expires" on a timed
  mode):
  - ______________________
  - ______________________
  - ______________________

---

## 8. Scoring & competition (Required)

- **High score**: does this game have a natural numeric score worth
  tracking as a personal best? Most arcade-style games: yes. Most
  mastery-style games (Build the Atom): no — mastery isn't a "score,"
  don't force one in for consistency.
  ______________________
- **XP vs. mastery — confirm these stay separate signals.** XP is
  engagement (feeds the cross-game leaderboard); mastery score is
  learning (feeds the main platform's study-plan logic). A game can award
  generous XP for fun replay value without that inflating mastery, and
  vice versa — never conflate them in this game's design.
- **Leaderboard**: any game with a high score automatically feeds the one
  cross-game XP leaderboard — no per-game decision needed unless
  deviating from that default. State the deviation here if any:
  ______________________

---

## 9. Subject metadata — only fill in if this is a NEW subject (Optional)

Skip entirely if using an existing subject (chemistry / mathematics /
physics / biology already have name, emoji, color, and accent token in
`lib/content/subjects.ts` / `motion/tokens.css`).

If genuinely new:
- **Subject key** (slug): ______________________
- **Display name**: ______________________
- **Emoji**: ______________________
- **Accent color** (new `--eg-subject-*` token, following the existing
  pattern): ______________________

Note: an unregistered subject key falls back gracefully (auto-capitalized
label, generic emoji, brand-color accent) — but that's a placeholder, not
a finished environment. Add the real entry as part of THIS section before
the game ships, not after.

---

## 10. Environment & visual design (Required — this is where most of the actual design work lives)

### 10.1 — Full-bleed environment backdrop

The background shown behind both the pre-play flow (`PrePlayShell`) and
live gameplay (`GameplayShell`), via `lib/content/gameEnvironments.ts`.

- **Setting / mood description** — be as specific as you would be
  briefing an illustrator, not "a lab": ______________________
- **What's in the foreground vs. background** — what's allowed to be
  detailed/high-contrast vs. what must stay visually quiet because
  gameplay content renders on top of it. Per the binding standard: the
  center zone where the actual interactive content sits must stay low-
  contrast; personality belongs in the outer margins and top/bottom
  bands. Describe the composition left-to-right, top-to-bottom:
  ______________________
- **Color & lighting direction** (e.g. "cool-toned, slightly desaturated,
  night-shift energy" for Element Hunter's hunting tension):
  ______________________
- **Style**: painted/illustrated, matching the existing mascot
  illustration style used across the app — flag explicitly if this game
  needs to deviate and why.
- **Desktop image path**: `/illustrations/<slug>-desktop.png`
- **Mobile image path**: `/illustrations/<slug>-mobile.png` (can point at
  the same file as desktop if no separate crop exists yet; the type
  always wants both so a future asset swap needs no code change)
- **Accent color** (CSS variable or hex, usually derived from the
  subject's existing token): ______________________
- **Suggested image-generation prompt** (if art will be AI-generated —
  write the full prompt here for approval before generation, per the
  brief's instruction not to let placeholder art quietly become
  permanent): ______________________

If skipped, the game falls back to a generic gradient — a visibly
unfinished state, not hidden.

### 10.2 — Card art + description

The small thumbnail on the homepage and `/worlds` grid
(`lib/content/gameCardMeta.ts`) — a different asset from 10.1's full
backdrop.

- **Card art path**: `/illustrations/card-<slug>.svg` (or `.png`). If no
  bespoke art exists yet, name an existing game's art to reuse as an
  explicit, flagged placeholder — never a silent gap.
  ______________________
- **One-sentence card description** (shown under the title):
  ______________________

### 10.3 — Mobile-specific rendering risk (Required if this is a new engine — see Section 0)

- **Does this mechanic involve continuous recalculation while the player
  drags/manipulates something** (geometry, physics, ray tracing, particle
  systems)? If yes: ______________________
- **Confirmed rendering approach** (canvas 2D, SVG transform, CSS
  transform-only — NOT a physics engine, per the platform's explicit "no
  heavy 3D / resource-intensive graphics" constraint):
  ______________________
- **Tested on representative low-end hardware or throttled DevTools?**
  Y/N, and what was observed: ______________________

---

## 11. Missions (Required — at least one)

For each mission:

- **Mission key** (slug): ______________________
- **Title**: ______________________
- **Difficulty** (`EASY` / `MEDIUM` / `HARD`): ______________________
- **Sequence index**: ______________________
- **XP reward**: ______________________
- **Learning goal** (one sentence, shown on the briefing screen — the
  concept itself, not the narrative framing): ______________________
- **Estimated minutes**: ______________________
- **Payload** (the engine-specific content this mission uses — see
  Section 3's content shape): ______________________

**Content volume reminder**: enough distinct content that a student
playing daily for two weeks doesn't see exact repeats constantly — a
known gap to flag explicitly here if the first content pass is thinner
than that (e.g. "only 6 missions for now, more later"), not silently
shipped as if it were the final scope.

**Content correctness reminder**: simplify scope (fewer cases, an easier
subset), never simplify into something factually false. If a real-world
example needs trimming for a mission, swap the example rather than teach
an incorrect version of it.

---

## 12. Offline & low-connectivity behavior (Required)

Every game on this platform needs to behave reasonably with intermittent
connectivity — Nigeria, low-end Android is the explicit target user, not
an edge case.

- **Does this game need to persist anything beyond the standard
  AttemptResult on completion** (e.g. a notebook/journal entry, an
  intermediate save mid-mission)? If so, name exactly what and how it
  should behave if connectivity drops mid-write:
  ______________________
- **Confirm**: a completed mission's `AttemptResult` queues via the
  existing offline attempt queue (IndexedDB) if the POST to `/api/attempts`
  fails, and flushes automatically once connectivity returns — this is
  already handled by `GameRuntime`/`OfflineQueueFlusher` for every game
  with no extra work, UNLESS this game has additional state beyond the
  standard AttemptResult (the case above), which needs its own explicit
  plan.

---

## 13. Open questions / unresolved decisions (Required section header — even if empty)

List anything still undecided when this spec gets handed off, so nothing
gets silently guessed at during implementation. An empty list here is a
real, positive signal that the spec is complete — don't skip writing
"None" if that's genuinely true.

- ______________________
- ______________________

---

## Appendix — Worked example references

Two real, shipped games filled out against an earlier version of this
template, kept here as calibration for "how detailed should my answers
be":

**Element Hunter** (`tile-match`): bright arcade-grid environment,
fast/energetic mood; core mechanic is tap-the-tile-matching-the-clue,
moment of truth is the tap itself checked against the clue's match rule;
content scope 36 elements (grew from an initial 18 — a real example of
the content-volume standard being applied after the fact); feedback is
burst + score pop + streak counter on success, shake + mascot-encourage +
small time penalty on failure, no hard fail; high score yes (score +
streak), feeds the cross-game leaderboard.

**Atom Forge** (`bond-match`): cosy crystal-workshop environment,
warm/cosy mood; core mechanic is drag-one-atom-near-another, moment of
truth is the drop checked against the current mission's valid pair; 4
levels where BOTH content and mechanic get harder (L1 ionic only, L2
covalent with a new animation, L3 mixed with no bond-type hint, L4 adds a
real timer+quantity constraint); feedback is bond-type-specific animation
+ burst + compound card on success, shake + hint on failure (L4 swaps in
a harmless "poof" instead of the standard spark); high score yes (XP per
level), feeds the cross-game leaderboard.
