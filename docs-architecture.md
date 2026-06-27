# ExamPrep Learning Games Engine — Architecture (v2)

**Stack:** Next.js (App Router) · TypeScript · Prisma + PostgreSQL (SQLite for local dev) · Plain React state (no Redux/Zustand) · HTML5/CSS/SVG for gameplay rendering (no canvas/WebGL engine)
**Scale target:** Secondary students in Nigeria, low-end Android, intermittent connectivity
**Mode:** Standalone repo, own DB, designed for easy integration later (no shared-DB assumptions baked into game code)
**Bar for UI/UX:** Top-notch — significant investment in motion, tactile feedback, and sound-hook design per game, unified by one shared system (Section 7) rather than reinvented per game

> **What changed since v1:** this revision formalizes three decisions made after the first engine (`particle-assembly`, built for Build The Atom) was prototyped: (1) content is now organized by subject as well as by engine, (2) progressive difficulty is a first-class, engine-agnostic data shape rather than something buried in one engine's config, (3) a shared visual/motion/touch/sound system is extracted as its own module so "top-notch UI" compounds across games instead of being redone from scratch each time.

---

## 0. Design principles driving every decision below

1. **Games are content, not code.** A game = a config object (JSON-like) + an engine that knows how to run that shape of config. Adding a new mission to an existing engine should never require new React components.
2. **One result contract, many engines — and expect the engine count to grow.** Every engine, no matter how different its gameplay, ends its run by producing the same shape of result object. This is what makes the "non-negotiable data contract" enforceable in code, not just in docs. Unlike the original plan, the team should expect game UI, gameplay mechanics, and concepts to genuinely differ from game to game — the architecture is built to keep absorbing new engines indefinitely, not to converge on a small fixed set.
3. **Integration is an adapter, not a foundation.** The DB/auth/export layer is isolated behind interfaces so "standalone now, shared-DB or API later" is a config change, not a rewrite.
4. **Boring tech, small surface area — except where the product bar says otherwise.** No state management library, no asset pipeline beyond Next's built-in image handling, no canvas/WebGL engine. The one deliberate exception is motion/sound polish (Section 7): since "top-notch UI" is an explicit product requirement, that layer gets real design investment — but it's investment made *once*, in a shared module, not per-game.
5. **Content is organized by subject; code is organized by mechanic.** These are different axes and shouldn't collapse into one folder structure — see Section 1.
6. **Difficulty is a data shape, not a policy.** Every engine reports difficulty/sequence metadata in the same shape; what a student is actually shown next (fixed order vs. adaptive) is decided by something outside the engine entirely, so that decision can change later without touching engine code.

---

## 1. Folder Structure

```
examprep-games/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (player)/
│   │   │   ├── play/
│   │   │   │   └── [gameSlug]/
│   │   │   │       └── page.tsx      # Loads game config, mounts <GameRuntime>
│   │   │   ├── worlds/
│   │   │   │   └── page.tsx          # World/subject map (game selection screen)
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (admin)/                  # Internal tool for adding/editing game content
│   │   │   └── admin/
│   │   │       └── games/
│   │   │           ├── page.tsx      # List games
│   │   │           └── [id]/page.tsx # Edit game config JSON
│   │   │
│   │   ├── api/
│   │   │   ├── games/route.ts            # GET list, POST create (admin)
│   │   │   ├── games/[id]/route.ts       # GET single config
│   │   │   ├── attempts/route.ts         # POST: submit a completed attempt
│   │   │   ├── students/[id]/progress/route.ts  # GET: per-topic progress
│   │   │   ├── students/[id]/next-mission/route.ts  # GET: which mission to show next (difficulty policy lives behind this)
│   │   │   └── export/route.ts           # Outbound sync to main platform (stubbed)
│   │   │
│   │   └── layout.tsx
│   │
│   ├── engines/                      # The reusable mechanic engines — one per INTERACTION SHAPE, not one per game
│   │   ├── engine-types.ts           # Shared TS interfaces every engine implements
│   │   ├── registry.ts               # Maps engineType string -> engine module
│   │   │
│   │   ├── particle-assembly/        # Built: live-counter assembly toward a target composition (Build The Atom)
│   │   │   ├── ParticleAssemblyEngine.tsx
│   │   │   ├── particleAssembly.config.ts    # Zod schema for this engine's config shape
│   │   │   └── particleAssembly.logic.ts     # Pure scoring/validation logic (testable, no React)
│   │   │
│   │   ├── multi-stage/              # Planned, not yet built: sequential rooms/questions with per-stage correctness
│   │   │   ├── MultiStageEngine.tsx
│   │   │   ├── multiStage.config.ts
│   │   │   └── multiStage.logic.ts
│   │   │
│   │   └── _future/                  # Placeholder — expect this directory to keep growing.
│   │                                  # Each genuinely new interaction shape (drag-to-place, vector
│   │                                  # navigation, equation-balancing, etc.) gets its own folder here.
│   │                                  # Judgment call each time: "same shape as an existing engine,
│   │                                  # new content" vs. "new interaction, new engine" — see Section 8.
│   │
│   ├── components/
│   │   ├── runtime/
│   │   │   ├── GameRuntime.tsx       # Orchestrates: Snapshot -> Engine -> Reflection -> Export
│   │   │   ├── ConceptSnapshot.tsx   # "Before Play" 20-60s briefing
│   │   │   ├── ReflectionScreen.tsx  # "After Play" results + actions
│   │   │   └── QuestBriefing.tsx     # Instruction-reveal pattern (quest-log style)
│   │   ├── ui/                       # Buttons, cards, progress bars — shared low-level UI
│   │   └── world/
│   │       └── WorldMap.tsx          # Subject/topic selection screen
│   │
│   ├── motion/                       # NEW — shared visual/motion/touch/sound system (Section 7)
│   │   │                             # Engines import from here instead of inventing their own
│   │   │                             # animation/touch/sound patterns. Extracted from the Build The
│   │   │                             # Atom v2 prototype; grows as new engines reveal new primitives.
│   │   ├── tokens.css                # Color ramps per subject, durations, easing curves
│   │   ├── orbitalMotion.ts          # Reusable cluster-jitter + orbit-shell helpers (DOM/CSS based)
│   │   ├── payoffSequence.ts         # Multi-beat success/failure choreography helper
│   │   ├── touchTarget.ts            # Pointer-event binding + min-hit-area helpers for mobile feel
│   │   └── sound/
│   │       ├── playSound.ts          # The stubbed/synthesized sound hook — swap internals for real assets later
│   │       └── soundProfiles.ts      # Per-cue tone definitions (placeholder) / asset manifest (future)
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── prisma.ts             # Prisma client singleton
│   │   │   └── queries/              # One file per entity: games.ts, missions.ts, attempts.ts, progress.ts
│   │   ├── scoring/
│   │   │   └── masteryFormula.ts     # Weighted-average mastery update (mirrors main platform's shape)
│   │   ├── difficulty/               # NEW — sequencing POLICY, deliberately separate from engines
│   │   │   ├── fixedOrderPolicy.ts   # Default: play missions in array/sequenceIndex order
│   │   │   └── adaptivePolicy.ts     # Placeholder: pick next mission from mastery score (not built yet)
│   │   ├── export/
│   │   │   ├── ExportAdapter.ts      # Interface: reportAttempt(result) -> void
│   │   │   ├── LocalDbAdapter.ts     # Default: writes to this app's own DB only
│   │   │   └── ApiAdapter.ts         # Future: POSTs to main platform's API (stubbed, unused by default)
│   │   ├── offline/
│   │   │   └── attemptQueue.ts       # IndexedDB queue for attempts made while offline
│   │   └── validation/
│   │       └── gameConfig.schema.ts  # Top-level Zod schema (engineType + engine-specific payload + difficulty fields)
│   │
│   ├── content/
│   │   └── games/                    # Organized by SUBJECT — content's own axis, separate from engines/
│   │       ├── chemistry/
│   │       │   ├── build-the-atom.json       # engineType: particle-assembly
│   │       │   └── balance-equation.json     # engineType: particle-assembly (reused, new content)
│   │       ├── biology/
│   │       │   └── cell-explorer.json        # engineType: multi-stage
│   │       ├── physics/
│   │       │   └── circuit-builder.json      # engineType: tbd
│   │       └── mathematics/
│   │           └── vector-field.json         # engineType: tbd (likely a new engine — see Section 8)
│   │
│   └── types/
│       └── result.ts                 # The shared AttemptResult type — the data contract, in code
│
├── public/
│   └── game-assets/                  # SVGs/sprites, organized per subject, lightweight only
│
├── .env.example
├── next.config.js
└── package.json
```

**Why this shape:**
- `engines/` is the only place gameplay logic lives, organized by **mechanic**, not subject. Each engine folder is self-contained: a config schema, pure logic, and a React component. A new engine doesn't touch any other folder except `registry.ts` (one line) and `content/games/<subject>/` (new JSON files).
- `content/games/` is organized by **subject**, the opposite axis from `engines/`. A subject folder never contains code — only JSON files, each declaring which engine it runs on. This is deliberate: code scales by mechanic count (small, slow-growing), content scales by subject/topic count (large, fast-growing). Forcing both onto the same axis means duplicating engine logic per subject or losing subject-level organization entirely — neither is acceptable at scale.
- `motion/` is new in this revision — see Section 7. It exists so "top-notch UI" is a system every engine inherits from, not a per-game reinvention.
- `lib/difficulty/` is new in this revision — see Section 6. It's deliberately *not* inside `engines/`, because sequencing policy (what to show next) is a platform-level decision, not a mechanic-level one.
- `lib/export/` is the seam the brief asks for — swapping standalone → shared DB → API later means writing a new `ExportAdapter`, not touching engines, runtime, or DB queries.
- `lib/scoring/masteryFormula.ts` deliberately mirrors the main platform's weighted-average shape (per brief) so that if you do move to a shared DB later, the numbers mean the same thing.

---

## 2. Key Modules and Responsibilities

| Module | Responsibility | Does NOT do |
|---|---|---|
| **Engine modules** (`engines/*`) | Own one *mechanic family*'s rules: render gameplay, validate moves, compute a raw outcome (correct/score/time). | Doesn't know about topics, students, or the DB. Pure mechanic + a callback `onComplete(rawOutcome)`. |
| **`GameRuntime`** | Orchestrates the full loop: show Concept Snapshot → mount the right engine via `registry.ts` → receive raw outcome → build the `AttemptResult` (attaches topicId, studentId, gameId, timestamp) → call the export adapter → show Reflection screen. | Doesn't contain any subject-specific logic — it's the same component for every game. Doesn't decide sequencing — that's `lib/difficulty/`. |
| **`registry.ts`** | Single source of truth mapping `engineType` (string, stored on each game config) to the engine's React component + config validator. | Doesn't store game content itself — that's in the DB/`content/games/<subject>/`. |
| **Game config (DB row / JSON)** | Declarative description of one game: which engine, the engine-specific payload (e.g. target atom's proton/neutron/electron counts), topic/subtopic ID, display metadata, and a `missions[]` array each carrying `difficulty` + `sequenceIndex`. | No code, no logic — must be JSON-serializable so non-engineers (content team) can eventually author games via the admin panel. |
| **`motion/` system** | Shared visual/motion/touch/sound primitives — orbital particle motion, multi-beat success/failure payoff choreography, mobile touch-target binding, the stubbed sound-cue hook. Engines call into this instead of writing their own animation/touch code. | Doesn't know about game content or scoring — it's pure presentation, reusable by any engine. |
| **`lib/difficulty/` (policy)** | Decides *which mission a student sees next*, given the mission list's difficulty/sequence metadata and (for adaptive policy) the student's mastery score. Swappable: `fixedOrderPolicy` today, `adaptivePolicy` later. | Doesn't live inside any engine — engines just report difficulty per mission, they don't decide sequencing. |
| **`ExportAdapter` (interface)** | Defines `reportAttempt(result: AttemptResult): Promise<void>`. | Implementation-agnostic — callers never know if it's local DB, queued, or remote API. |
| **`LocalDbAdapter`** | Default implementation: writes attempt + updates mastery/XP in this app's own DB. | Used until cross-app integration is decided. |
| **`attemptQueue` (offline)** | Buffers attempts in IndexedDB when the network is unavailable; flushes to the active `ExportAdapter` when connectivity returns. | Doesn't decide *where* attempts ultimately go — just guarantees nothing is lost offline. |
| **`masteryFormula.ts`** | Pure function: `(previousScore, attemptsCount, newOutcome) -> newScore`. Weighted-average, mirrors main platform. | No DB access — pure calculation, easy to unit test and to swap if the main platform's formula changes. |
| **Admin module** (`(admin)/admin/games`) | CRUD on game configs, validated against each engine's Zod schema before save. | No analytics/dashboards — that's the main platform's job; this is content authoring only. |

---

## 3. Data Flow

### 3.1 Playing a game (happy path)

```
Student taps a game on World Map
        │
        ▼
GET /api/students/[id]/next-mission?gameId=...  ──►  lib/difficulty policy picks a mission
        │                                              (fixedOrderPolicy today; adaptivePolicy
        │                                               later reads TopicProgress.masteryScore)
        ▼
GET /api/games/[id]  ──────────────►  Game config (engineType + payload + topicId + missions[])
        │
        ▼
GameRuntime mounts
        │
        ├─► ConceptSnapshot shown (20-60s, from config.snapshot)
        │
        ▼
registry.get(engineType) ──► resolves to e.g. ParticleAssemblyEngine
        │
        ▼
Engine renders gameplay (using motion/ system for animation, touch, sound cues), student plays
        │
        ▼
Engine calls onComplete(rawOutcome)  // e.g. { success: true, timeSpentSec: 47, attemptsBeforeSuccess: 2 }
        │
        ▼
GameRuntime builds AttemptResult:
   { studentId, gameId, missionId, topicId, subtopicId, success, score, timeSpentSec, completedAt }
        │
        ├──► ExportAdapter.reportAttempt(result)
        │         │
        │         ├─ online  → POST /api/attempts → DB write + masteryFormula update
        │         └─ offline → attemptQueue.enqueue(result) → flushed later
        │
        ▼
ReflectionScreen shown (uses AttemptResult + updated mastery to render feedback)
```

### 3.2 Authoring a game (admin)

```
Admin opens /admin/games/[id]
        │
        ▼
Loads raw config JSON
        │
        ▼
On save: validate against gameConfig.schema.ts
   (top-level fields) + engine-specific schema (e.g. buildToTarget.config.ts)
        │
        ▼
POST/PUT /api/games/[id] → Prisma write
```

### 3.3 Future cross-app sync (not built now, just the seam)

```
LocalDbAdapter (today)  ──swap──►  ApiAdapter (future)
        │                                │
        ▼                                ▼
  this app's DB                 POST to main ExamPrep API
                                 { topicId, studentId, success/score, timeSpent }
```
Nothing in `GameRuntime` or any engine changes when this swap happens — only `lib/export/index.ts`'s active adapter export changes.

---

## 4. Database Schema (Prisma)

Kept intentionally separate from the main platform's schema (per brief — standalone DB), but field names are chosen to map cleanly onto `topicId`/`subtopicId` if a shared DB or sync job is introduced later.

```prisma
// schema.prisma

model Game {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  engineType  String              // e.g. "particle-assembly", "multi-stage"
  subject     String              // "chemistry", "biology", etc. — mirrors content/games/<subject>/ folder
  topicId     String              // ID from main platform's curriculum (string, not FK — no shared DB)
  subtopicId  String?
  sharedConfig Json               // engine-specific payload NOT tied to one mission (e.g. generator definitions)
  snapshot    Json                // Concept Snapshot content { lines, readTimeSec }
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  missions    Mission[]
  attempts    Attempt[]
}

// Pulled out as its own model (was buried inside Game.config JSON in v1).
// This is the engine-agnostic difficulty/sequencing data every game must report,
// regardless of which engine renders it — see Section 6.
model Mission {
  id            String   @id @default(cuid())
  gameId        String
  missionKey    String              // engine-local id, e.g. "carbon-14" (matches the JSON content file)
  title         String
  difficulty    Difficulty
  sequenceIndex Int                 // default play order; fixedOrderPolicy reads this directly
  xpReward      Int
  topicId       String              // usually same as parent Game.topicId, but can differ (e.g. isotope sub-skill)
  subtopicId    String?
  payload       Json                // engine-specific target/content for THIS mission (e.g. { proton: 6, neutron: 8, electron: 6 })
  isActive      Boolean  @default(true)

  game          Game     @relation(fields: [gameId], references: [id])
  attempts      Attempt[]

  @@unique([gameId, missionKey])
  @@index([gameId, sequenceIndex])
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

model Student {
  id          String   @id @default(cuid())
  externalId  String?  @unique   // main platform's student ID, when integration lands
  displayName String
  xpTotal     Int      @default(0)
  createdAt   DateTime @default(now())

  attempts    Attempt[]
  progress    TopicProgress[]
}

model Attempt {
  id            String   @id @default(cuid())
  studentId     String
  gameId        String
  missionId     String?            // nullable: some future engine might not have discrete missions
  topicId       String
  subtopicId    String?
  success       Boolean?           // null when mechanic uses continuous score instead
  score         Float?             // 0-1 normalized; null for pure pass/fail mechanics
  timeSpentSec  Int?
  attemptsBeforeSuccess Int?       // engine-reported retry count, used as a difficulty/struggle signal
  xpAwarded     Int      @default(0)
  rawOutcome    Json               // engine's original outcome object, kept for debugging/analytics
  completedAt   DateTime @default(now())

  student       Student  @relation(fields: [studentId], references: [id])
  game          Game     @relation(fields: [gameId], references: [id])
  mission       Mission? @relation(fields: [missionId], references: [id])

  @@index([studentId, topicId])
  @@index([gameId])
}

model TopicProgress {
  id            String   @id @default(cuid())
  studentId     String
  topicId       String
  subtopicId    String?
  masteryScore  Float    @default(0)   // 0-1, weighted-average per masteryFormula.ts
  attemptsCount Int      @default(0)
  isMastered    Boolean  @default(false)
  updatedAt     DateTime @updatedAt

  student       Student  @relation(fields: [studentId], references: [id])

  @@unique([studentId, topicId, subtopicId])
}
```

**Notes:**
- `Mission` is new in this revision — v1 buried mission-level difficulty inside `Game.config` JSON, which meant the difficulty policy (Section 6) would have had to parse engine-specific JSON to sequence missions. Pulling `difficulty`/`sequenceIndex`/`xpReward` out to real columns means `fixedOrderPolicy` and the future `adaptivePolicy` can query them directly, regardless of engine. The engine-specific part of a mission (target composition, room layout, whatever) stays in `Mission.payload` JSON — only the *sequencing-relevant* fields are promoted to columns.
- `Game.topicId` / `Mission.topicId` / `Attempt.topicId` are plain strings, not foreign keys into a `Topic` table — this repo doesn't own the curriculum, the main platform does.
- `Attempt.rawOutcome` keeps the engine's untouched output — useful for debugging and for richer Reflection screens, without polluting the normalized `success`/`score` fields the data contract cares about.
- `Attempt.attemptsBeforeSuccess` is new — every engine should report this where the mechanic supports retry-until-success (per the Build The Atom outcome shape). It's a free difficulty/struggle signal that costs nothing to store and is exactly the kind of data an `adaptivePolicy` would eventually read.
- `xpAwarded` is per-attempt and sums into `Student.xpTotal` — kept separate from `masteryScore` exactly as the brief specifies (engagement signal vs. learning signal).

---

## 5. API Endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/games` | List active games, filterable by `?subject=` or `?topicId=` (powers World Map) | Student session |
| `GET` | `/api/games/[id]` | Fetch one game's full config (engine type, shared payload, snapshot, missions[]) | Student session |
| `POST` | `/api/games` | Create a new game config (validated against engine's Zod schema) | Admin only |
| `PUT` | `/api/games/[id]` | Update a game config | Admin only |
| `GET` | `/api/students/[id]/next-mission?gameId=` | Returns which `Mission` to play next for this student in this game, per the active difficulty policy (Section 6) | Student session (self) |
| `POST` | `/api/attempts` | Submit a completed `AttemptResult`; triggers mastery update + XP award | Student session |
| `GET` | `/api/students/[id]/progress` | Per-topic mastery scores for a student (used by Reflection screen + future dashboard hooks) | Student session (self) or Admin |
| `POST` | `/api/export` | (Stubbed) Outbound sync endpoint for a future job that pushes attempts to the main platform | Internal/service auth |

**`POST /api/attempts` request shape** (this is the data-contract enforcement point):

```ts
{
  studentId: string;
  gameId: string;
  missionId?: string;       // which Mission this attempt was for, if the engine has discrete missions
  topicId: string;
  subtopicId?: string;
  success?: boolean;        // for pass/fail mechanics
  score?: number;           // 0-1, for continuous-outcome mechanics
  timeSpentSec?: number;
  attemptsBeforeSuccess?: number;  // retry count before success, where the mechanic supports retrying
  rawOutcome: object;        // engine-specific, stored as-is
}
```
Server validates that *either* `success` or `score` is present, computes `xpAwarded` via a simple fixed table (e.g. base XP + completion bonus, optionally read from `Mission.xpReward`), updates `TopicProgress` via `masteryFormula.ts`, and writes the `Attempt` row.

---

## 6. Progressive Difficulty — designed as a slot, not a locked-in policy

You weren't sure yet whether progression should be fixed-order, adaptive, or both — so the architecture is built to support either without committing now. The key move: **every mission reports the same difficulty/sequencing metadata regardless of engine, and something outside the engine decides what to do with it.**

**What every mission carries** (now real DB columns, not buried JSON — see `Mission` model in Section 4):
- `difficulty`: `EASY | MEDIUM | HARD`
- `sequenceIndex`: default play-order integer
- `xpReward`: reward for completing this specific mission
- (via `Attempt`) `attemptsBeforeSuccess`: a free per-student, per-mission struggle signal, reported by any engine whose mechanic allows retrying

**What decides what a student plays next** — `lib/difficulty/`, not any engine:
- `fixedOrderPolicy` (build this first): student plays missions in `sequenceIndex` order, same sequence for everyone. This is what Build The Atom already does informally (Hydrogen → Helium → Carbon-14 → Oxygen → Sodium → Magnesium).
- `adaptivePolicy` (placeholder, not built yet): would read the student's `TopicProgress.masteryScore` for the relevant topic and pick a harder or easier mission accordingly — using exactly the mastery data the platform already tracks for the main app's learning path, so no new student-modeling work is needed to support this later.
- Both are called the same way: `GET /api/students/[id]/next-mission?gameId=` returns one `Mission`. Swapping the active policy is a one-line config change in that route handler — engines, content JSON, and `GameRuntime` never know which policy is active.

**Why this matters for "games will differ":** because sequencing is decided outside the engine, a wildly different engine (say, a vector-navigation game with continuous difficulty rather than discrete missions) can still participate — it just needs to expose *some* notion of difficulty/sequence in its own mission shape, even if "missions" don't look like Build The Atom's at all. The contract is "report difficulty," not "have exactly this kind of level list."

---

## 7. Shared Visual / Motion / Touch / Sound System

This section exists because of an explicit product decision: UI quality is "top-notch," not "good enough" — and because games will genuinely vary in environment, character, and mechanic, that quality bar has to be written down and shared, or it gets re-litigated and re-built (at lower quality, under time pressure) for every new game.

> **Revision note (post Atom Forge v2 / Snowball Toss):** the visual *direction* changed twice since this section was first written — from neon-glass, to illustrated/mascot, to a dark/neon detour for one game, back to illustrated as the standing direction. The 7.1 checklist below is the thing that's supposed to survive direction changes: it's a *quality bar*, not a specific palette. A game's environment, character design, or color story can vary; whether it clears 7.1 should not.

### 7.1 The Visual Quality Bar — a living checklist

This is the standard every game's UI is expected to clear, regardless of that game's specific environment or character design. **Different games do not need to look the same** — Build The Atom's lab and Snowball Toss's snowy mountain are visually distinct worlds — but both need to pass every item below.

This list is expected to change as we build more games. When a new game reveals the checklist is missing something, or a line no longer makes sense, edit it — that's the intended use of this section, not a deviation from it. See the changelog convention at the end of 7.1.

- [ ] **Painted, layered backdrop.** Not a flat color or single gradient. At minimum: a far layer and a near layer that together suggest depth and a specific place (a lab corner, a mountainside, a workshop). Reference builds: `scene-backdrop.svg` (Build The Atom), `snowy-backdrop.svg` (Snowball Toss), `forge-backdrop.svg` (Atom Forge).
- [ ] **The mascot is present and reactive at key emotional beats** — at minimum: a greeting/idle moment at entry, a celebrate pose on success, an encourage pose on a wrong/missed attempt. Same character every game; only the backdrop changes around it.
- [ ] **Tactile, chunky UI chrome.** Buttons and cards read as physical, pressable objects: solid fill (not glass/transparent), a drop-shadow "lip" that compresses on press (`translateY` + shadow shrink on `:active`), rounded corners, dashed or solid colored borders. Never flat-flush-with-background, never glassmorphic blur-and-glow.
- [ ] **Every outcome has motion with weight**, not an instant state change:
  - *Arrival* (an object entering play) has a bounce/arc/settle, not a teleport-in.
  - *Success* is a multi-beat sequence (impact/burst → reward card or number → mascot reacting), not a single flash.
  - *Failure/near-miss* is gentle: a small shake and/or spark, the mascot's encourage pose, a plain-language hint — never a harsh red error state with no character warmth.
- [ ] **Subject/game gets its own accent color**, drawn consistently across that game's buttons, borders, and highlights — so games feel related (same chrome language) without feeling identical (different accent + different backdrop).

**Changelog** (add an entry here whenever this checklist changes, so the reasoning isn't lost):
- *This revision*: checklist created, backfilled from what Build The Atom v2, Atom Forge v2, and Snowball Toss already do in practice.

### 7.2 Shared code modules

**What's in `motion/` and where it came from:** built by extracting patterns validated in working prototypes, not designed top-down. `tokens.css`'s actual color *values* have changed direction more than once (see revision note above) — what's stable is the variable names and the pattern of "subjects/games get an accent, everything else inherits shared tokens."

| Module | What it captures | Validated in |
|---|---|---|
| `tokens.css` | Shared color roles (background, text, accent-per-subject, gold/danger universal accents), motion durations, easing curves. Variable names are stable even when the palette direction changes. | Re-pointed from neon to warm/illustrated values without touching call sites |
| `orbitalMotion.ts` | Cluster-with-jitter placement (objects gather near a center point with continuous small motion) and rotating-orbit placement (objects circle at increasing radii / shells) — both CSS-transform-based, no physics engine | Nucleus jitter + electron shell orbits (Build The Atom) |
| `payoffSequence.ts` | Multi-beat choreography helper for success (state-flip → flash/scale → burst → delayed secondary reward beat) and failure (brief tactile shake) — parameterized so any engine can trigger "big success" or "soft failure" without re-deriving timing | Stabilize sequence (Build The Atom); bond burst + shake (Atom Forge) |
| `touchTarget.ts` | Pointer-event (not mouse-only) binding helpers, minimum-hit-area padding around visually smaller controls, press-state feedback that fires correctly on touch | Generator buttons' 88px hit-area around a smaller visible circle |
| `sound/playSound.ts` | A single stable call site per cue, backed today by synthesized Web Audio tones, swappable later for licensed/real assets without touching any engine's call sites | Mute-toggle + synthesized-tone implementation |
| `Mascot.tsx` | The platform's one recurring host character, swappable by pose (`idle`/`celebrate`/`encourage`) | Build The Atom, Atom Forge, Snowball Toss all reuse the same component |

**The rule for new engines:** an engine should reach for `motion/` primitives and check itself against the 7.1 checklist before writing bespoke animation/backdrop code. Bespoke code that proves itself becomes a candidate for promotion into `motion/` for the next game — the same "prove it in one game, then extract" pattern used to build this section.

**Explicit non-goal:** this is not a full design system with component library or brand guidelines — it's the specific quality bar and primitives proven useful so far, expected to keep changing as more games get built.

---

## 8. Why this stays maintainable for a small team

- **Adding a game** (the common case) = one JSON config + admin entry, placed in the right `content/games/<subject>/` folder. Zero new code if it fits an existing engine.
- **Adding an engine** (expected to happen regularly, not rarely — see Section 0.2) = one new folder under `engines/`, one registry line. Doesn't touch runtime, DB schema, content folders, or other engines.
- **Adding a new subject** = a new folder under `content/games/`. Doesn't require any engine changes — subjects and engines are orthogonal.
- **Changing integration strategy later** = new `ExportAdapter`, not a rewrite of gameplay code.
- **Changing difficulty/sequencing policy later** = new file in `lib/difficulty/`, swap one config reference. No engine touched.
- **Offline support** is isolated to one queue module — engines and runtime don't need to know whether they're online.
- **UI polish compounds instead of resetting per game** — once a motion/touch/sound pattern is proven in one engine, it's available to every engine built after it, rather than each game starting its visual-quality investment from zero.

### 8.1 The judgment call: same engine, or new engine?

Since games are expected to genuinely differ, the recurring decision is: does a new game reuse an existing engine with new content, or does it need a new engine? Ask:

- **Same engine, new content:** the *shape* of the interaction matches — same kind of input (discrete adds, sequential stages, drag gesture, etc.), same kind of check-and-feedback timing, just different target/content. Build The Atom and a hypothetical "Build The Molecule" both fit `particle-assembly`.
- **New engine needed:** the feedback timing, input gesture, or win-condition structure is structurally different — not just visually different. This was the actual reasoning that produced `particle-assembly` as distinct from a hypothetical generic "build-to-target": live counters with continuous visual assembly and check-on-submit is a different shape than check-on-every-action.
- **When genuinely unsure:** prototype against the closest existing engine first. If forcing the new game's content into that engine's config schema feels like fighting the schema (needing new fields that don't generalize, or workarounds for timing the engine doesn't support), that's the signal to build a new engine instead.

---

## 9. Open items for the next conversation (per-game design, not architecture)

- **How to brief a new game:** see `game-design-template.md` — the fill-in-the-blanks format for specifying a new game's identity, environment, mechanic, progression, content, feedback rules, session bookends, and scoring, so a build can start without re-deriving structure each time. Includes two worked examples (Element Hunter, Atom Forge v3) showing the template applied retroactively, plus a running list of cross-game gaps it surfaced (concept-snapshot depth, end-of-session review, hints, leaderboard).
- **What every game must satisfy:** see `game-specification-standards.md` — the checklist a filled-in template needs to pass (content correctness/volume, environment quality bar, real progression, engine-fit reasoning, no-punishment tone, XP-vs-mastery separation, session bookends). Distinct from the template: the template is what you fill in, this is what the answers are checked against.
- Mechanic spec for the next engine to build (`multi-stage`, or whatever the next product brief calls for) — what its `config`/`Mission.payload` shape looks like concretely.
- Whether `adaptivePolicy` gets built now or stays a placeholder until there's enough attempt data to make adaptive sequencing meaningful.
- Continued extraction into `motion/` as new engines reveal which v2-prototype patterns are genuinely general-purpose vs. specific to particle-assembly.
- Final decision on hosting/integration path (subdomain + shared auth vs. fully separate) — doesn't block building against `LocalDbAdapter` now.
