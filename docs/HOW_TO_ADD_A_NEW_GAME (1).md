# How to Add a New Game to EXL

**This is the operational guide** — the step-by-step process for going from
idea to a live game in the app. Keep this open while building.

For the full design spec template (what to decide before you start building),
see `GAME_DESIGN_SPEC_TEMPLATE_MASTER.md`.

---

## Overview

Adding a game involves four stages:

```
1. DESIGN    Write the spec — what the game does, how it teaches
2. AUTHOR    Write the JSON content file + seed script
3. CODE      Update the supporting code files
4. SHIP      Seed the DB locally, commit, push to GitHub → Vercel deploys
```

If the game uses an **existing engine**, Stage 3 is small (5 file edits, no new code).
If the game needs a **new engine**, Stage 3 is a full build.

---

## Stage 1 — Design

Fill in `GAME_DESIGN_SPEC_TEMPLATE_MASTER.md` before writing a single line of code.

The critical decisions to make first:

1. **Which engine?** — See the engine table below. Reusing saves weeks.
2. **progressionMode?** — `trackMap`, `levelSelect`, or `linear`.
3. **Pedagogical arc?** — How does scaffolding reduce across missions?
4. **Mission count?** — Minimum 8 for a trackMap game. Enough for 2 weeks of daily play.

**Do not skip this stage.** Discovering the engine doesn't fit after content is written is the most expensive mistake.

---

## Stage 2 — Author the content file

### 2.1 — Create the game JSON

Create: `src/content/games/<subject>/<game-slug>.json`

Subject must be one of: `chemistry` / `mathematics` / `physics` / `biology`

**Full JSON structure:**

```json
{
  "slug": "my-game-slug",
  "title": "My Game Title",
  "engineType": "stepwise-equation-solver",
  "subject": "mathematics",
  "topicId": "simultaneous-linear-equations",
  "subtopicId": "elimination-method",
  "progressionMode": "trackMap",
  "sharedConfig": { },
  "snapshot": {
    "cards": [
      { "title": "Key Concept", "body": "One idea. One example." },
      { "title": "How to Play", "body": "What the student physically does." }
    ]
  },
  "missions": [
    {
      "missionKey": "case-0001",
      "title": "Case #0001 — First Contact",
      "difficulty": "EASY",
      "sequenceIndex": 1,
      "xpReward": 20,
      "topicId": "simultaneous-linear-equations",
      "subtopicId": "elimination-method",
      "learningGoal": "One sentence shown on the mission briefing.",
      "estimatedMinutes": 3,
      "payload": { }
    }
  ]
}
```

> **`missionKey` and `slug` are permanent.** Never change them after the game
> is live — they are the DB keys that link to player progress and analytics.

### 2.2 — Available engines and their sharedConfig + payload shapes

---

#### `stepwise-equation-solver`
Student chooses the next algebraic operation step by step.

**sharedConfig:**
```json
{
  "entry": { "title": "Math Detective", "missionLabel": "Active Case" },
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
  "hints": { "levels": ["Vague hint.", "More specific hint.", "Near-explicit hint."] },
  "review": {
    "title": "YOUR STRATEGY",
    "efficiencyLabel": "Efficiency",
    "successLines": ["Case solved. File archived.", "Another case closed."]
  },
  "scoring": {
    "strategyWeight": 0.4, "efficiencyWeight": 0.3,
    "hintWeight": 0.2, "speedWeight": 0.1, "speedBaselineSec": 90
  }
}
```

**Mission payload:**
```json
{
  "caseNumber": "#0001",
  "stage": "guided",
  "equations": [
    { "id": "eq1", "display": "x + y = 8" },
    { "id": "eq2", "display": "x − y = 2" }
  ],
  "learningGoal": "One sentence.",
  "solutionSteps": [
    {
      "description": "Plain English description",
      "operation": "add",
      "resultDisplay": ["2x = 10"],
      "targetVariable": "y",
      "isFinal": false
    },
    {
      "description": "Solve for x",
      "operation": "solve",
      "resultDisplay": ["x = 5"],
      "targetVariable": "x",
      "isFinal": false
    },
    {
      "description": "Substitute x = 5 into eq1",
      "operation": "substitute",
      "resultDisplay": ["5 + y = 8", "y = 3"],
      "targetVariable": "y",
      "isFinal": true
    }
  ],
  "alternativeValidOperations": [],
  "solution": { "variables": { "x": 5, "y": 3 } },
  "caseHints": [
    "Level 1 — vague",
    "Level 2 — specific",
    "Level 3 — near-explicit (also highlights the correct button)"
  ]
}
```

Valid `operation` values: `"add"` `"subtract"` `"multiply_eq1"` `"multiply_eq2"` `"solve"` `"substitute"`

Valid `stage` values: `"guided"` `"assisted"` `"supported"` `"independent"` `"mastery"`

`isFinal` is optional. Only set `true` on the last step of each mission.

`multiplyFactor` — only needed for `multiply_eq1` / `multiply_eq2`. Shows on the button (e.g. `× 2`).

---

#### `particle-assembly`
Add countable particles to hit a target composition.

**sharedConfig:**
```json
{
  "entry": { "title": "Build The Atom", "missionLabel": "Today's Challenge" },
  "generators": [
    { "id": "proton",   "label": "Proton Generator",   "particleLabel": "Proton",   "color": "#ef5d4e", "panel": "left"   },
    { "id": "neutron",  "label": "Neutron Generator",  "particleLabel": "Neutron",  "color": "#8b7fa3", "panel": "right"  },
    { "id": "electron", "label": "Electron Generator", "particleLabel": "Electron", "color": "#2f9bd6", "panel": "bottom" }
  ],
  "feedbackRules": [
    { "when": "proton_count_mismatch", "message": "This has {protonCount} protons. {targetElement} has {targetProtonCount}." },
    { "when": "any_mismatch", "message": "Not quite — check your counts." }
  ],
  "review": { "successLines": ["Correct! That's {resultLabel}."] },
  "elementsByProtonCount": { "1": "Hydrogen", "6": "Carbon", "8": "Oxygen" }
}
```

**Mission payload:**
```json
{ "target": { "proton": 6, "neutron": 8, "electron": 6 }, "resultLabel": "Carbon-14" }
```

---

#### `tile-match`
Timed — read a clue, tap the matching element tile. All content in sharedConfig. Mission payload is `{}`.

**sharedConfig:**
```json
{
  "elementPool": ["H","He","Li","C","N","O","F","Ne","Na","Cl"],
  "sessionDurationSec": 60,
  "tileCount": 9,
  "tiers": [
    { "id": "easy",   "label": "Cadet",    "clueFocus": "atomicNumber",     "advanceAfter": 5 },
    { "id": "medium", "label": "Agent",    "clueFocus": "elementFamily",    "advanceAfter": 5 },
    { "id": "hard",   "label": "Director", "clueFocus": "valenceElectrons", "advanceAfter": 999 }
  ]
}
```

---

#### `bond-match`
Drag two atoms together to form compounds. Atom Forge uses per-mission payload.

**sharedConfig:** `{}`

**Mission payload:**
```json
{
  "elementPool": ["Na","Cl","Mg","O","K","F","H","N"],
  "showBondTypeHint": true,
  "missions": [
    { "key": "nacl", "formula": "NaCl", "name": "Sodium Chloride", "bondType": "ionic",    "pair": ["Na","Cl"], "xpReward": 5 },
    { "key": "h2o",  "formula": "H₂O",  "name": "Water",           "bondType": "covalent", "pair": ["H","O"],   "xpReward": 5 }
  ],
  "sessionLength": 5
}
```

---

#### `optics-experiment`
Drag an object, observe image formation live.

**sharedConfig:**
```json
{
  "focalLength": 2, "objectHeightUnits": 1,
  "mirrorOptions": ["concave", "convex"],
  "showFocusLabels": true, "showCenterLabels": true,
  "showRaysToggle": false, "defaultShowRays": true
}
```

**Mission payload:**
```json
{
  "mirrorOptions": ["concave"],
  "showFocusLabels": true, "showCenterLabels": true,
  "showRaysToggle": true, "defaultShowRays": true,
  "winConditions": {
    "targetImageType": "real",
    "targetMagnificationMin": 1.2,
    "targetMagnificationMax": 2.5
  },
  "hint": "Drag the object past F for a real image.",
  "prediction": {
    "question": "What kind of image forms when...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 1,
    "explanation": "Because..."
  }
}
```

---

### 2.3 — progressionMode quick reference

| Value | What the player sees | Use when |
|---|---|---|
| `"trackMap"` | Locked path. Tap a mission, complete it, next one unlocks. | Skills build sequentially. Most games. |
| `"levelSelect"` | All missions always visible and tappable. | Missions are genuinely independent levels (Atom Forge). |
| `"linear"` | Auto-advances after each mission. No picker. | Short games, 4–6 missions, uniform difficulty. |

**`trackMap` with multiple difficulty tiers** (EASY + MEDIUM + HARD missions): the app automatically shows a difficulty picker screen first (🟢 Easy / 🟡 Medium / 🔴 Hard), then shows only that tier's missions on the track map. On return, resumes at the first incomplete mission in the chosen tier.

---

### 2.4 — Pedagogical stages for `stepwise-equation-solver`

Set `"stage"` in each mission's payload. This is separate from `difficulty` — a `guided` mission can have hard maths; a `mastery` mission can have simple maths.

| Stage | Game does | Student does | Typical difficulty | XP |
|---|---|---|---|---|
| `"guided"` | Shows next step, one "tap to confirm" button | Follow and observe | EASY | 15–25 |
| `"assisted"` | One question at a time (which variable? which operation?) | One decision per turn | MEDIUM | 35–55 |
| `"supported"` | All buttons visible, auto-hints after wrong attempts | Plan full sequence | HARD | 55–75 |
| `"independent"` | No prompts, hint button on request | Full independence | HARD | 65–90 |
| `"mastery"` | Independent + shows optimal path after completion | Compare and optimise | HARD | 95–100 |

**Recommended arc for an 11-mission game:**
Missions 1–4 → `guided` / EASY
Missions 5–8 → `assisted` / MEDIUM
Mission 9 → `supported` / HARD
Mission 10 → `independent` / HARD
Mission 11 → `mastery` / HARD (highest XP)

---

### 2.5 — XP scale

| Stage / Difficulty | XP range |
|---|---|
| EASY / guided | 15–25 |
| MEDIUM / assisted | 35–55 |
| HARD / supported | 55–75 |
| HARD / independent | 65–90 |
| HARD / mastery — final mission | 95–100 |

---

## Stage 3 — Update the code files

### 3.1 — Files to update for EVERY new game

| File | What to add |
|---|---|
| `src/lib/content/gameCardMeta.ts` | Card art path + one-sentence description |
| `src/lib/content/gameEnvironments.ts` | Desktop + mobile backdrop image paths |
| `src/lib/content/missionBriefing.ts` | One narrative flavor line for this slug |
| `src/lib/content/gameTopics.ts` | New topicId entry (only if the topic ID is new) |
| `src/lib/content/quickConcepts.ts` | Fallback snapshot cards (shown if DB snapshot missing) |

### How to add each entry

**`gameCardMeta.ts`** — add to both `GAME_CARD_ART` and `GAME_CARD_DESC`:
```typescript
// GAME_CARD_ART:
"my-game-slug": "/mascot/card-my-game-slug.svg",

// GAME_CARD_DESC:
"my-game-slug": "One sentence describing what makes this game worth playing.",
```

**`gameEnvironments.ts`** — add one entry:
```typescript
"my-game-slug": {
  desktop: "/illustrations/my-game-slug-desktop.png",
  mobile:  "/illustrations/my-game-slug-mobile.png"
}
```
> If art doesn't exist yet, the app falls back to a deep navy gradient —
> intentional and acceptable until real art is ready.

**`missionBriefing.ts`** — add one entry:
```typescript
"my-game-slug": "One exciting sentence. Why is the student here? Not the rules — the reason."
```
*Example: "Detective, we've intercepted a coded transmission — use elimination to determine the values before the case file closes."*

**`gameTopics.ts`** — only if the topicId is brand new:
```typescript
{ id: "my-topic-id", label: "My Topic Name", subject: "mathematics" }
```

**`quickConcepts.ts`** — add fallback cards:
```typescript
"my-game-slug": [
  { title: "Key Concept", body: "One idea. One example." },
  { title: "How to Play", body: "What the student physically does." }
]
```

### 3.2 — Files to create for EVERY new game

```
public/mascot/card-<slug>.svg      ← small card thumbnail (hand-coded SVG)
public/illustrations/<slug>-desktop.png   ← full-bleed backdrop art
public/illustrations/<slug>-mobile.png    ← mobile crop (can be same file)
```

> Missing images won't crash the app — both pre-play screens and the game engine
> fall back to a deep navy gradient. Create these when the art is ready.

### 3.3 — Files to create/update for a NEW ENGINE only

New engines are rare. Only build one when the moment of truth is genuinely different from all existing engines — not because the subject is different.

```
src/engines/<engineType>/
  <engineType>.config.ts       ← Zod schemas: SharedConfig, MissionPayload, Outcome
  <engineType>.logic.ts        ← Pure functions only, no React
  <engineType>Engine.tsx       ← React component, uses <GameplayShell>
  <engineType>Engine.module.css

src/engines/registry.ts        ← add one entry
```

**Registry entry:**
```typescript
import { MyEngine } from "@/engines/my-engine/MyEngine";
import { MyEngineSharedConfigSchema } from "@/engines/my-engine/myEngine.config";

const myEngineDefinition: EngineDefinition = {
  engineType: "my-engine",
  configSchema: MyEngineSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: MyEngine as unknown as EngineDefinition["Component"]
};

// Add to the registry object:
"my-engine": myEngineDefinition
```

**Engine TypeScript rules that WILL fail at Vercel build time if wrong:**

1. `mission.payload as MyType` — TypeScript rejects this in strict mode.
   Use `mission.payload as unknown as MyType` instead.

2. `<Mascot line={...} />` — `Mascot` only accepts `pose`, `widthPx`, `className`, `style`.
   Put speech in a sibling `div`, not a prop.

3. Sound cues — only these values are valid: `"particleAdd" | "particleRemove" | "submit" | "success" | "fail" | "xp"`.
   Any other string fails TypeScript. Map your game's events to these.

4. `isFinal` on solution steps — optional (defaults to `false`). Only set `true` on the last step.

5. Inline import types (`parameter: import("./file").Type[]` inside a function signature) — valid TypeScript but breaks Next.js's SWC compiler. Import the type at the top of the file.

---

## Stage 4 — Write the seed script

Create: `scripts/seed-<game-slug>.mjs`

Copy this template exactly — it matches the pattern of `scripts/seed-mirror-lab.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fresh = process.argv.includes("--fresh");
const SLUG = "my-game-slug";

// Always use process.cwd() — NOT import.meta.url.
// import.meta.url resolves unreliably on Windows.
const gameData = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/content/games/<subject>/my-game-slug.json"),
    "utf-8"
  )
);

async function run() {
  console.log(`Seeding ${SLUG} → ${BASE}/api/games`);

  if (fresh) {
    console.log("  Deleting existing record...");
    const del = await fetch(`${BASE}/api/games?slug=${SLUG}`, { method: "DELETE" });
    if (del.status === 404 || del.status === 500) {
      console.log("  (no existing record — skipping delete)");
    } else if (del.ok) {
      const body = await del.json().catch(() => ({}));
      console.log("  Deleted:", body.deleted ?? "ok");
    } else {
      console.warn(`  Delete returned ${del.status}`);
    }
  }

  console.log("  Inserting...");
  const res = await fetch(`${BASE}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameData),
  });

  const rawText = await res.text();
  console.log(`  Response status: ${res.status}`);

  let body = {};
  try { body = JSON.parse(rawText); } catch (_) {}

  if (res.ok) {
    console.log("✅  Seeded!");
    console.log("    Game ID:  ", body.game?.id ?? "—");
    console.log("    Missions: ", gameData.missions.length);
    console.log("    Play at:   http://localhost:3000/play/my-game-slug");
    return true;
  }

  const msg = body.error ?? rawText;
  if (msg.includes("duplicate") || msg.includes("unique")) {
    console.error("❌  Already exists. Run with --fresh to replace it.");
  } else {
    console.error("❌  Seeding failed:", msg);
  }
  return false;
}

run().then((ok) => {
  if (!ok) process.exitCode = 1;
});
```

---

## Stage 5 — Seed and ship

### Seed locally

```bash
# Terminal 1 — start the dev server
npm run dev

# Terminal 2 — from the project root
node scripts/seed-my-game-slug.mjs            # first time
node scripts/seed-my-game-slug.mjs --fresh    # if replacing an existing record
```

**If seeding fails with `{}`** — the API route is crashing. Add `rawText` logging to the seed script (already in the template above) to see the actual error. The most common cause: the engine files aren't in git, so the registry doesn't include the engine, and the API rejects the `engineType`.

**If seeding fails with ENOENT** — check the filename character by character. A single typo (`simultaenous` vs `simultaneous`) causes this. Run `dir src/content/games/<subject>/` to see what's actually there.

### Commit and deploy

```bash
git add src/content/games/<subject>/my-game-slug.json
git add scripts/seed-my-game-slug.mjs
git add src/lib/content/gameCardMeta.ts
git add src/lib/content/gameEnvironments.ts
git add src/lib/content/missionBriefing.ts
git add src/lib/content/quickConcepts.ts
git add src/engines/   # if new engine files were added
git add src/engines/registry.ts  # if engine was added
git commit -m "add my-game-slug game"
git push
```

Vercel deploys automatically from GitHub. Wait for the build to complete — check the **Vercel dashboard → Deployments** for ✅ Ready or ❌ Error. A TypeScript error causes Vercel to serve the last working build silently — always check the build log.

The game uses the **same Supabase database** as local dev — no separate production seed needed. The game will appear on `/worlds` and be playable immediately after a successful build.

---

## Common mistakes and how to fix them

| Symptom | Cause | Fix |
|---|---|---|
| "No engine registered for type X" on deployed app | Engine files not committed to git | `git add src/engines/` then commit and push |
| Seeding fails with `{}` | Build error in engine code prevents the registry from loading | Check Vercel build log for TypeScript errors |
| Seeding fails with ENOENT | Filename typo or wrong directory | `dir src/content/games/<subject>/` to verify |
| Seeding fails with 500 on DELETE | Game not in DB yet | Safe to ignore — the script continues to INSERT |
| TypeScript error: `Property 'payload' does not exist` | Engine config type has payload fields merged onto mission directly | Config type needs `mission: { payload: Record<string, unknown> }` |
| TypeScript error: `Conversion of type 'Record<string, unknown>' to type 'X' may be a mistake` | Direct `as MyType` cast | Use `as unknown as MyType` |
| TypeScript error: `Property 'line' does not exist on type MascotProps` | Mascot doesn't accept a `line` prop | Put speech in a sibling `div` with its own class |
| TypeScript error: Argument of type `"my_sound"` is not assignable to `SoundCue` | Invalid sound cue name | Use only: `"particleAdd"`, `"particleRemove"`, `"submit"`, `"success"`, `"fail"`, `"xp"` |
| SWC parse error at unrelated line | Inline import type in function signature OR mixed line endings | Import type at file top; normalise line endings to LF |
| Game not showing on Worlds page | Missing entry in `gameCardMeta.ts` OR not seeded in DB | Add both |
| Game shows but environment is white/blank | No art + no fallback | Now fixed: app uses deep navy gradient fallback automatically |
| "Already exists" on seed | Prior seed succeeded | Use `--fresh` flag |
| Step repeating in `stepwise-equation-solver` | Stale closure in `advanceStep` capturing old `currentStepIndex` | Pass `nextIndex` explicitly through `pendingAdvanceRef` |

---

## Quick reference — complete file checklist

### Content files (always)
- [ ] `src/content/games/<subject>/<slug>.json`
- [ ] `scripts/seed-<slug>.mjs`

### Code files (always)
- [ ] `src/lib/content/gameCardMeta.ts` — add art path + description
- [ ] `src/lib/content/gameEnvironments.ts` — add image paths
- [ ] `src/lib/content/missionBriefing.ts` — add flavor line
- [ ] `src/lib/content/quickConcepts.ts` — add fallback cards
- [ ] `src/lib/content/gameTopics.ts` — add topicId IF new

### Art files (when ready)
- [ ] `public/mascot/card-<slug>.svg`
- [ ] `public/illustrations/<slug>-desktop.png`
- [ ] `public/illustrations/<slug>-mobile.png`

### New engine only
- [ ] `src/engines/<engineType>/<engineType>.config.ts`
- [ ] `src/engines/<engineType>/<engineType>.logic.ts`
- [ ] `src/engines/<engineType>/<engineType>Engine.tsx`
- [ ] `src/engines/<engineType>/<engineType>Engine.module.css`
- [ ] `src/engines/registry.ts` — add entry

### After everything is ready
- [ ] `npm run dev` is running
- [ ] `node scripts/seed-<slug>.mjs` succeeds
- [ ] Game appears at `http://localhost:3000/play/<slug>`
- [ ] `git add` all new/changed files
- [ ] `git commit -m "add <slug> game"`
- [ ] `git push`
- [ ] Vercel build shows ✅ Ready (not ❌ Error)
- [ ] Game appears on deployed `/worlds` page
