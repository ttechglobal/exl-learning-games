# EXL Game Design Specification — Master Template

**Version 2.0** — Updated after shipping Simultaneous Equations: Math Detective.
Copy this file, rename it to the game's slug (e.g. `quadratic-lab.md`), and fill in every section before any code is written.

This replaces all earlier template versions. Do not use `NEW_GAME_SPEC_TEMPLATE.md` or `GAME_DESIGN_SPEC_TEMPLATE.md` — archive them.

**Why every section exists.** Each one maps to something the platform's code requires: the engine registry, `AttemptResult`, `GameplayShell`, `ConceptSnapshot`, `gameEnvironments.ts`, `missionBriefing.ts`, the seed script, and the DB schema. Skipping a section means a real gap in the running app, not just an incomplete document.

**Sections marked (Required)** must be complete before a build starts.
**Sections marked (Optional — has fallback)** can be skipped for a prototype, but the fallback is visibly unfinished — fine for internal testing, not for real students.

---

## 0. Engine decision (Required)

The single most important judgment call. Get it wrong and everything downstream is wrong too.

**An engine is the mechanic itself** — what's on screen, how the player interacts, and the ONE moment that gets checked to decide success or failure. Two games can look completely different and still be the same engine if that checked moment has the same shape. Don't request a new engine because a game "feels different." Request one because the moment of truth is structurally different.

### Engines that exist today

| Engine | Moment of truth | Example game | progressionMode |
|---|---|---|---|
| `tile-match` | Player taps a tile; the tap is checked against the current clue's match rule; loops in a timed session | Element Hunter | `linear` |
| `bond-match` | Player drops one item onto another; the drop is checked against the mission's valid pair | Atom Forge | `levelSelect` |
| `particle-assembly` | Player presses Submit; the full set of added units is checked against a target composition | Build The Atom | `linear` |
| `molecule-builder` | Player presses Submit; every filled slot + bond count is checked against the target structure | Carbon Builder | `trackMap` |
| `optics-experiment` | Player drags an object to a position; the resulting image properties are checked against the mission's win conditions | Mirror Lab | `trackMap` |
| `stepwise-equation-solver` | Player taps the next algebraic operation; the tap is checked against the current step's correct operation AND whether it's strategically optimal | Math Detective | `trackMap` |

### Engine fit check

1. **Name the exact moment of truth in one sentence.** Not "the player plays the level" — the one input that gets checked.
2. **Compare that sentence against each row above.** If it matches one (even loosely), reuse that engine. Reusing means this spec is content-only — no new component, no new schema, no registry change. Dramatically lower cost and risk.
3. **If none match**, this is a new-engine project. See Section 0.3 below.

- [ ] Reuses existing engine: `______________________`
- [ ] Needs a new engine (Section 0.3 must fully specify the mechanic)

### 0.3 — If this is a new engine: four questions that must be answered here

These come from real gaps discovered building Mirror Lab and Math Detective — each question is a place that was skipped and caused a problem.

**Question 1 — What exactly gets checked, and when?**
Walk through the player's actual input sequence and name the precise check. "The player selects an operation and the game checks if it's correct" is good. "The player does the step" is too vague — checked how? Exact match? Partial credit? Multiple valid paths? Decide now.

**Question 2 — Does every mission type have a real win condition?**
If the design includes "free exploration" or "no objective" modes, decide explicitly what `success` reports for it. "The player interacted for N seconds" is a defensible answer. "There is no answer" is not — it leaves a hole in `AttemptResult` that breaks mastery scoring.

**Question 3 — What does wrong-answer feedback look like, specifically?**
The platform default is: gentle shake + mascot encourage + hint, no hard penalty. Name the exact moment this fires for your mechanic. For stepwise operations it fires immediately on each wrong tap; for a prediction-based mechanic it fires after the experiment runs.

**Question 4 — Can the core interaction run on a low-end Android phone?**
If the mechanic involves continuous recalculation while dragging (physics simulation, ray tracing, live geometry), you need a technical spike. Test on Chrome DevTools with CPU throttling before writing the full spec. A mechanic that's smooth on a developer laptop and unusable on a ₦40,000 Android phone is the most expensive mistake to discover after content is written.

### 0.4 — What does this engine generalise to?

Name 2–3 future games this engine could power beyond this one. If you can't name them, reconsider whether it's a real engine investment or a one-off. `stepwise-equation-solver` generalises to: quadratic equations, chemical balancing, algebraic fractions, differentiation procedures.

---

## 1. What the game is about (Required)

- **Slug** (lowercase-kebab-case — becomes the URL, the seed script filename, the DB key, and every content lookup key): `______________________`
- **Title** (shown to players): `______________________`
- **Subject** (`chemistry` / `mathematics` / `physics` / `biology`, or new — see Section 9): `______________________`
- **Topic ID** (slug matching the real ExamPrep curriculum — feeds mastery scoring): `______________________`
- **Subtopic ID** (optional, slug): `______________________`
- **One-sentence pitch** — what the player actually DOES, not what they learn: `______________________`
- **What concept does this reinforce?** One sentence on what the student can DO afterward, not just "knows about X": `______________________`
- **Why does this mechanic teach that concept well?** The connection between the mechanic and the concept — if they don't actually connect, catch it here before content is written: `______________________`
- **Why NOT a quiz?** What this mechanic does that multiple-choice can't. If you can't answer this, the concept may be quiz-shaped underneath a game skin: `______________________`

**Data contract:** every scorable unit (mission, round, experiment) must resolve to a real topic/subtopic ID from the actual curriculum. Never a game-invented category.

---

## 2. Student fantasy & world framing (Required)

The framing that makes a mechanic feel like a game instead of an exercise. Fill in with real specificity.

- **Who is the player, in-world?** (e.g. "a junior detective at the International Mathematical Investigation Bureau"): `______________________`
- **What's the daily/session framing?** (e.g. "every day the Bureau receives coded mathematical transmissions that need decrypting"): `______________________`
- **Mission Briefing flavor line** — one narrative sentence shown at the top of the pre-play screen (`lib/content/missionBriefing.ts`). Excitement, not explanation. Example: *"Detective, we've intercepted a coded transmission — use elimination techniques to determine the unknown values before the case file closes."*: `______________________`

*If skipped, falls back to: "Welcome back. Your next challenge is ready — complete it to earn XP and keep climbing." — generic, acceptable for prototypes only.*

---

## 3. Core gameplay mechanic (Required)

### 3.1 — If reusing an existing engine

- **Core interaction** (drag, tap, drop, type): `______________________`
- **Content shape** — fill in the block matching the engine from Section 0:

  **`stepwise-equation-solver`**: For each mission, provide: case number, pedagogical stage (`guided`/`assisted`/`supported`/`independent`/`mastery`), two equations, solution steps (each with description, operation type, result display lines, target variable, isFinal flag), alternative valid operations, final solution values, and 3 hint strings.

  **`tile-match`**: item/clue pool (every property a clue can test), tile count, session length defaults.

  **`bond-match`**: item pool (every draggable item), pairs/missions (key, display name, bond type, valid pair, XP reward) OR factory mode (same pair data + quantities + session duration).

  **`particle-assembly`**: generators (id, label, particle label, color, panel), target compositions (exact counts + result label per mission), feedback rules (mismatch messages + element lookup table).

  **`molecule-builder`**: atom roster (symbol, max bond count, color), missions (target structure as named slots with row/col position, bond type per connection, dock contents).

  **`optics-experiment`**: mirror options, focal length, label visibility, win conditions (targetImageType, targetMagnificationMin/Max, etc.), optional prediction question.

### 3.2 — If this is a new engine

Write the FULL mechanic specification — this becomes both the content schema and the engineering brief:

- **Step-by-step interaction flow**, numbered, from mission start to mission end.
- **The exact moment of truth** — what input, checked against what rule, produces success vs. not-yet-correct.
- **Real-time vs. checked-on-submit?** This single decision drives most technical risk.
- **State that needs to persist across one mission** — list every piece of state the engine component must track.
- **What does this generalise to?** (Section 0.4)

### 3.3 — Win / lose / scoring (Required — answer all three even if the answer is "no fail state")

- **Win condition**: `______________________`
- **Lose condition, if any** (some engines have no fail state — "not yet correct" is legitimate, say so explicitly): `______________________`
- **Scoring method** — XP-only completion, or time/accuracy-weighted 0–1 score? For `stepwise-equation-solver` the composite score uses: strategy weight (40%), efficiency weight (30%), hint usage (20%), speed (10%): `______________________`
- **attemptsBeforeSuccess**: does this mechanic support retrying within one mission? Confirm it's in the raw outcome the engine returns: `______________________`

### 3.4 — Hint system (Required)

- **When do hints appear?** Default: after 1 wrong attempt. `stepwise-equation-solver` uses 1 for Easy/Medium, 2 for Hard. Guided stage shows hints immediately. Independent/Mastery stages require the player to tap "I need a hint": `______________________`
- **What does the hint actually reveal?** Must TEACH, not solve. `stepwise-equation-solver` hints are progressive: level 1 vague (which variable?), level 2 specific (which operation?), level 3 near-explicit (button highlights): `______________________`

---

## 4. Pedagogical progression (Required — this replaces the old "difficulty" section)

**The core principle**: remove scaffolding across stages, don't just change the numbers. A student who gets the right answer by following a script hasn't learned anything durable. Responsibility must transfer from the game to the learner.

### 4.1 — The five stages (for procedure-based games using `stepwise-equation-solver`)

Set the `stage` field on each mission's `payload`. This is independent of `difficulty` — a guided mission can have complex equations; a mastery mission can have simple ones.

| Stage | Game does | Student does | XP range |
|---|---|---|---|
| `guided` | Shows next step in plain English. One "tap to confirm" button. | Follow instructions and observe the effect. | 15–25 |
| `assisted` | Asks one question at a time (which variable? then which operation?). | Make one strategic decision at a time. | 35–55 |
| `supported` | All buttons visible. Hints appear automatically after wrong attempts. | Plan the full sequence of operations. | 55–75 |
| `independent` | No prompts. Hint button available but student must tap it. | Solve using any valid strategy. | 65–90 |
| `mastery` | Independent + shows the optimal path after completion for comparison. | Optimise reasoning and minimise unnecessary steps. | 95–100 |

### 4.2 — For session-based / timed games (tile-match, bond-match)

State explicitly which of these applies — don't settle for "two levels that play identically with different labels":

- **Content gets harder** (more items, same mechanic): `______________________`
- **Mechanic gets harder** (new interaction introduced mid-progression): `______________________`
- **Scaffolding gets removed** (visual aids hidden progressively): `______________________`

| Tier | What's actually different (not just numbers) | XP |
|---|---|---|
| Easy | | |
| Medium | | |
| Hard | | |

### 4.3 — Timed vs. untimed

- [ ] Untimed — fits mastery-style learning
- [ ] Timed — duration: `______`
- [ ] Mixed — reason: `______________________`

### 4.4 — progressionMode (Required — set explicitly, never rely on inference)

| Value | When to use | Example |
|---|---|---|
| `trackMap` | Ordered locked path. Mission N+1 locked until N completed. | Carbon Builder, Math Detective |
| `levelSelect` | Flat, unordered, always-unlocked. Each mission is a genuinely different level. | Atom Forge |
| `linear` | Auto-advances after each mission. Short games, uniform difficulty. | Element Hunter, Build The Atom |

**For `trackMap` games with multiple difficulty tiers** (like Math Detective): the system now shows a difficulty picker screen first (`difficultyTrack` state in `PlayClient`), then shows only that tier's missions on the track map. The player's last incomplete mission is automatically resumed on return.

Selected: `______________________`

---

## 5. Quick Concepts snapshot (Optional — has fallback, write this properly)

2–4 titled cards shown right before play, revisitable afterward. Each card is ONE idea with ONE concrete example. Not a paragraph.

**Real example (Atom Forge):**
1. **Ionic Bonds** — "A metal GIVES an electron to a non-metal."
2. **Covalent Bonds** — "Two non-metals SHARE electrons."
3. **How to Play** — "Drag two atoms close together to bond them."

Fill in for this game:

| Card title | Body (one idea + one example — no more) |
|---|---|
| | |
| | |
| | |
| How to Play | (what the student physically DOES, not what they learn) |

*If skipped, falls back to one generic line — acceptable for internal prototypes only.*

---

## 6. Feedback & tone (Required)

Platform-wide binding rules — these apply to every game:

- **No punishment, only guidance.** Wrong answers get a hint and a gentle consequence. Never a harsh fail state, never punishment-framed copy.
- **Mascot** — three poses: `idle` (greeting/waiting), `celebrate` (success), `encourage` (wrong answer). The `Mascot` component accepts only `pose`, `widthPx`, `className`, `style` — no `line` prop. Speech appears as a sibling `div`. Confirm this game uses the existing three poses, flag here if a new pose is genuinely needed.
- **Sound cues** — valid values are: `"particleAdd"` `"particleRemove"` `"submit"` `"success"` `"fail"` `"xp"`. Map your game's events to these. Do NOT invent new cue names — the TypeScript type will reject them at build time.
- **On success**: default is burst + reward card + mascot celebrate + XP. Specify below only if this game needs different copy (e.g. "CASE CLOSED" for Math Detective): `______________________`
- **On wrong answer**: default is gentle shake + mascot encourage + hint. Specify below only if a real penalty is needed: `______________________`
- **Wrong-answer copy should be specific**: name the actual issue, not just "Try again." For stepwise operations: "This operation cannot eliminate the selected variable. Try another approach." — names the specific problem.

---

## 7. Session structure (Required)

Standard bookends apply to every game:
```
Quick Concepts → Mission Briefing → (Difficulty picker if applicable) →
Mission Objectives → Gameplay → Reflection → Practice Recommendation
```

- **Quick Concepts** (Section 5) fires before every deliberate mission start (track map tap, level select tap). Does NOT re-fire on Next Mission auto-advance (by design — the player has seen it already for this game session).
- **Reflection screen** fires after every mission. Standard content: score, XP earned, "Next Mission" or "Back to Map" button.
- **Does this game need anything beyond the standard Reflection screen?** Additive content via the `extraContent` slot, not a replacement: `______________________`
- **Mission Objectives checklist** — 3–4 short ✓ lines, keyed by ENGINE type in `lib/content/missionObjectives.ts`. If reusing an existing engine, you inherit that engine's objectives for free. Fill in below only if this specific game needs different objectives:
  - `______________________`
  - `______________________`
  - `______________________`

---

## 8. Scoring & competition (Required)

- **High score** — does this game have a natural numeric score worth tracking as a personal best? Mastery-style games (Build The Atom, Math Detective): no natural high score. Arcade-style (Element Hunter): yes: `______________________`
- **XP vs. mastery** — these are separate signals and must stay that way. XP is engagement (feeds the cross-game leaderboard). Mastery score is learning (feeds the platform's study-plan logic). Never conflate them.
- **Leaderboard** — any game with a high score automatically feeds the one cross-game XP leaderboard. State any deviation: `______________________`

---

## 9. Subject metadata (Only if this is a NEW subject)

Skip if using `chemistry` / `mathematics` / `physics` / `biology` — these are already registered in `lib/content/subjects.ts` and `motion/tokens.css`.

If genuinely new:
- **Subject key** (slug): `______________________`
- **Display name**: `______________________`
- **Emoji**: `______________________`
- **Accent color** (new `--eg-subject-*` CSS token): `______________________`

---

## 10. Environment & visual design (Required)

### 10.1 — Full-bleed environment backdrop

Used in both `PrePlayShell` (pre-play flow) and `GameplayShell` (live gameplay), via `lib/content/gameEnvironments.ts`.

**IMPORTANT — missing art fallback:** Both `PrePlayShell` and `ConceptSnapshot` now have a deep navy gradient fallback (`linear-gradient(160deg, #0b1330 0%, #0e1a2e 55%, #0a1f3a 100%)`) when art is missing. This means the pre-play screens look intentional even without illustration assets. However, this is a fallback — real art should still be commissioned.

- **Setting / mood description** — brief as if briefing an illustrator: `______________________`
- **Composition** — what's in the foreground vs. background. The center zone where gameplay content sits must stay LOW-CONTRAST. Personality belongs in the outer margins and top/bottom bands: `______________________`
- **Color & lighting direction**: `______________________`
- **Style**: painted/illustrated, matching the existing mascot style — flag if deviation needed.
- **Desktop image path**: `/illustrations/<slug>-desktop.png`
- **Mobile image path**: `/illustrations/<slug>-mobile.png`
- **Accent color**: `______________________`
- **AI art prompt** (for approval before generation — do not generate without this being approved): `______________________`

### 10.2 — Card art + description

Shown on the homepage featured games section and the `/worlds` grid (`lib/content/gameCardMeta.ts`).

- **Card art path**: `/illustrations/card-<slug>.svg` (or `.png`). If no art exists, name an existing game's art to use as an explicit placeholder: `______________________`
- **One-sentence card description**: `______________________`

### 10.3 — Mobile rendering risk (Required for new engines)

- **Does this mechanic involve continuous recalculation while dragging?** If yes: `______________________`
- **Confirmed rendering approach** (canvas 2D, SVG transform, CSS transform-only — NOT a physics engine): `______________________`
- **Tested on throttled DevTools?** Y/N, what was observed: `______________________`

---

## 11. Missions (Required — at least one; recommend 8–14 for a trackMap game)

For each mission:

- **Mission key** (slug, unique within this game, NEVER change after launch): `______________________`
- **Title**: `______________________`
- **Difficulty** (`EASY` / `MEDIUM` / `HARD`): `______________________`
- **Sequence index** (unique integer starting at 1): `______________________`
- **XP reward**: `______________________`
- **Learning goal** (one sentence shown on the briefing screen): `______________________`
- **Estimated minutes**: `______________________`
- **Payload** (engine-specific — see Section 3.1's content shape for your engine): `______________________`

**Progression arc for trackMap games (from Math Detective experience):**

| Missions | Stage | What the game does | Student does |
|---|---|---|---|
| 1–4 (EASY) | `guided` | Shows each step, one "tap to confirm" button | Follow and observe |
| 5–8 (MEDIUM) | `assisted` | One question at a time | One decision per turn |
| 9 (HARD) | `supported` | All buttons, auto hints | Plan full sequence |
| 10 (HARD) | `independent` | No prompts, hint on request | Full independence |
| 11 (HARD) | `mastery` | Independent + optimal path shown after | Compare and optimise |

**Content volume:** enough that a student playing daily for two weeks doesn't see exact repeats. Flag explicitly if the first pass is thinner than that ("only 6 missions for now, more later"), not silently shipped as if it were final.

**Content correctness:** simplify scope (fewer cases, easier subset), never simplify into something factually incorrect.

---

## 12. Files to create / update (Required checklist — complete before handing off)

### New files (create these)

```
src/content/games/<subject>/<slug>.json          ← game + mission content
scripts/seed-<slug>.mjs                          ← seed script
public/illustrations/<slug>-desktop.png          ← environment art
public/illustrations/<slug>-mobile.png           ← mobile crop
public/mascot/card-<slug>.svg                    ← card thumbnail
```

### Files to update (patch these)

```
src/lib/content/gameCardMeta.ts                  ← card art path + description
src/lib/content/gameEnvironments.ts              ← desktop + mobile image paths
src/lib/content/missionBriefing.ts               ← narrative flavor line
src/lib/content/gameTopics.ts                    ← add topicId if new
src/lib/content/quickConcepts.ts                 ← fallback snapshot cards
src/lib/content/missionObjectives.ts             ← objectives checklist (if new engine)
```

### New engine only (rare — see Section 0)

```
src/engines/<engineType>/<engineType>.config.ts  ← Zod schemas
src/engines/<engineType>/<engineType>.logic.ts   ← pure functions, no React
src/engines/<engineType>/<engineType>Engine.tsx  ← React component
src/engines/<engineType>/<engineType>Engine.module.css
src/engines/registry.ts                          ← add one entry
```

### How to seed

```bash
# 1. Start dev server
npm run dev

# 2. In a separate terminal, from project root:
node scripts/seed-<slug>.mjs            # first time
node scripts/seed-<slug>.mjs --fresh    # replace existing

# 3. After committing and pushing to GitHub, Vercel deploys automatically.
#    The same Supabase DB is used by both local and Vercel, so no separate
#    production seed step is needed.
```

**Critical:** Always use `process.cwd()` not `import.meta.url` in seed scripts. `import.meta.url` resolves unreliably on Windows and causes ENOENT errors even when the file exists.

---

## 13. Known pitfalls (learned from shipping Math Detective)

These are real mistakes that cost time — read before building.

**TypeScript strict mode will catch what local dev ignores.**
Vercel builds with strict TypeScript. Three common failures:
1. `mission.payload as MyType` — TypeScript rejects this. Use `mission.payload as unknown as MyType`.
2. Custom prop that doesn't exist on a component (e.g. `<Mascot line={...} />`) — `Mascot` only accepts `pose`, `widthPx`, `className`, `style`. Speech goes in a sibling `div`.
3. Sound cue names — valid values only: `"particleAdd" | "particleRemove" | "submit" | "success" | "fail" | "xp"`. Any other string fails to compile.

**`StepwiseEquationSolverConfig.mission` must match `GameRuntimeMission`.**
The config type's `mission` field must have `payload: Record<string, unknown>` — not payload fields merged directly onto `mission`. `GameRuntime` always passes a `GameRuntimeMission` with nested payload.

**`isFinal` on `SolutionStep` is optional (defaults to `false`).**
Only the last step in a mission needs `"isFinal": true`. All other steps can omit it.

**Inline import types break SWC.**
`parameter: import("./file").Type[]` inside a function signature is valid TypeScript but fails in Next.js's SWC compiler. Import the type at the top of the file instead.

**Mixed line endings can break the SWC parser.**
If a file has both CRLF and LF line endings, SWC reports a parse error at an unrelated line. Normalise to LF.

**`progressionMode` must be set explicitly.**
`null` falls back to inference from mission difficulty mix, which can misread games with mixed EASY/MEDIUM/HARD missions. Always set it.

**The game API route validates `engineType` against the live registry.**
If the engine files aren't committed to git (and therefore aren't built by Vercel), `POST /api/games` will reject the seed with `Unknown engineType`. The error appears as `{}` in the seed script output. Fix: commit the engine files, push, wait for Vercel to build, then seed.

**Seed script ENOENT on Windows.**
Always run from the project root. Use `process.cwd()` not `import.meta.url`.

**`git status` says "clean" but Vercel still fails.**
Check the Vercel deployment log — the build may be erroring silently. A TypeScript error in any engine file causes Vercel to serve the last successful deployment (without the new engine). Always check the Vercel dashboard for ✅ / ❌ after every push.

---

## 14. Offline & low-connectivity behavior (Required)

Nigeria / low-end Android is the explicit target user — not an edge case.

- **Does this game need to persist anything beyond the standard `AttemptResult` on completion?** (e.g. a notebook entry, intermediate save mid-mission): `______________________`
- **Confirm**: a completed mission's `AttemptResult` queues via the existing offline attempt queue (IndexedDB) if the POST to `/api/attempts` fails, and flushes automatically once connectivity returns. This is handled by `GameRuntime`/`OfflineQueueFlusher` for every game with no extra work — UNLESS this game has additional state beyond `AttemptResult`, which needs its own explicit plan.

---

## 15. Open questions (Required section — write "None" if genuinely empty)

List anything still undecided when this spec is handed off. An empty list is a positive signal that the spec is complete.

- `______________________`

---

## Appendix A — The JSON content file format

Every game is authored as a JSON file in `src/content/games/<subject>/<slug>.json` and loaded into Supabase via `POST /api/games`. See `GAME_CONTENT_TEMPLATE.md` for the full JSON shape and all engine payload formats.

**The five fields the API route does NOT yet write to DB columns** (but include in JSON anyway — they'll wire up once the migration runs):
- `learningGoal` on missions
- `estimatedMinutes` on missions

---

## Appendix B — Engines reference

### `stepwise-equation-solver` sharedConfig shape

```json
{
  "entry": { "title": "Game Name", "missionLabel": "Active Case" },
  "tiers": [
    { "tier": "easy",   "label": "EASY",   "xpReward": 20, "showTargetVariable": true,  "showVariableChoice": false, "hintAfterAttempts": 1 },
    { "tier": "medium", "label": "MEDIUM", "xpReward": 40, "showTargetVariable": false, "showVariableChoice": true,  "hintAfterAttempts": 1 },
    { "tier": "hard",   "label": "HARD",   "xpReward": 75, "showTargetVariable": false, "showVariableChoice": true,  "hintAfterAttempts": 2 }
  ],
  "feedback": {
    "correctStep": ["Good observation.", "Sound reasoning.", "Correct. Proceed."],
    "suboptimalStep": "Valid, but not the most direct path. Efficiency reduced.",
    "invalidStep": "This operation cannot eliminate the selected variable. Try another approach.",
    "caseClosedPrimary": "CASE CLOSED",
    "caseClosedSecondary": "Excellent reasoning."
  },
  "hints": { "levels": ["Vague hint", "Specific hint", "Near-explicit hint"] },
  "review": { "title": "YOUR STRATEGY", "efficiencyLabel": "Efficiency", "successLines": ["Case solved.", "Another case closed."] },
  "scoring": { "strategyWeight": 0.4, "efficiencyWeight": 0.3, "hintWeight": 0.2, "speedWeight": 0.1, "speedBaselineSec": 90 }
}
```

### `stepwise-equation-solver` mission payload shape

```json
{
  "caseNumber": "#0001",
  "stage": "guided",
  "equations": [
    { "id": "eq1", "display": "x + y = 8" },
    { "id": "eq2", "display": "x - y = 2" }
  ],
  "learningGoal": "One sentence.",
  "solutionSteps": [
    {
      "description": "Plain English description of this step",
      "operation": "add",
      "resultDisplay": ["2x = 10"],
      "targetVariable": "y",
      "multiplyFactor": 2,
      "isFinal": false
    }
  ],
  "alternativeValidOperations": ["subtract"],
  "solution": { "variables": { "x": 5, "y": 3 } },
  "caseHints": [
    "Level 1 — vague strategy hint",
    "Level 2 — more specific",
    "Level 3 — near-explicit (also highlights the correct button)"
  ]
}
```

Valid `operation` values: `"add"` `"subtract"` `"multiply_eq1"` `"multiply_eq2"` `"solve"` `"substitute"`

`isFinal` is optional and defaults to `false`. Only set it to `true` on the last step.

---

## Appendix C — Worked examples

**Element Hunter** (`tile-match`, `linear`): arcade-grid, fast-paced, energetic mood. Moment of truth: tap on a tile checked against the current clue's match rule. Difficulty changes CONTENT (Easy: atomic number clues only → Hard: valence electron clues). 36 elements in the pool. High score: yes (score + streak). Feedback: burst + score pop + streak counter on correct, shake + small time penalty on wrong.

**Atom Forge** (`bond-match`, `levelSelect`): cosy crystal-workshop, warm mood. Moment of truth: drop of one atom onto another checked against the current mission's valid pair. Four levels where BOTH content AND mechanic get harder (L1 ionic only → L2 covalent with new animation → L3 mixed, no bond-type hint → L4 adds real timer + quantity constraint). High score: yes (XP per level).

**Mirror Lab** (`optics-experiment`, `trackMap`): scientific lab environment. Moment of truth: object position + mirror type checked against win conditions (image type, magnification range). 14 missions progressing through prediction, exploration, and formula calculation. No fail state — "not yet correct" only.

**Math Detective** (`stepwise-equation-solver`, `trackMap`): mathematical detective headquarters, deep navy + cyan. Moment of truth: operation selection checked against (1) correctness and (2) strategic optimality. 11 missions using all 5 pedagogical stages. "Try it yourself" button lets students replay guided missions as independent after completion. High score: no. Pre-game and Quick Concepts screens use deep navy fallback background when illustration art is missing.
