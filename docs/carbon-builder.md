# Game Spec: Carbon Builder

Filled out against the New Game Spec Template
(`docs/NEW_GAME_SPEC_TEMPLATE.md`). This is a **new engine** project, not a
content-only addition — most of this spec doubles as the engineering brief
for that engine.

---

## 0. Engine decision

- [x] **Needs a new engine: `molecule-builder`**

**Why no existing engine fits** (checked against both candidates before
concluding this):

- **`bond-match`** is fundamentally pairwise and resolve-and-clear: exactly
  two atoms find each other within a drag distance, one bond resolves, the
  pair turns into a "compound complete" card, and the mission advances.
  It has no concept of one atom holding multiple simultaneous bond slots
  with a running capacity counter, no overfill rejection, and no
  persistent growing structure across many bond actions. Methane alone
  (one carbon, four independent bonds, validated as a set) doesn't fit
  that shape; ethane/propane/butane chains fit it even less.
- **`particle-assembly`** is structurally closer in spirit — build toward
  a fixed target, validated explicitly on submit, not live-scored — but
  its "particles" are anonymous countable units added to generic
  counters (proton: 6, neutron: 8), not distinct draggable atoms forming
  actual bonds with their own per-atom capacity rules.

**Engine summary** (the brief): player drags atoms from a dock onto a
build surface and onto each other to form bonds. Each atom enforces its
own maximum bond capacity (carbon = 4, hydrogen = 1, oxygen = 2, etc.) and
shows a running `current/max` counter; exceeding capacity is rejected with
a clear visual flash, not silently allowed. Bonds have an explicit type
(single/double/triple), chosen via a distinct tool/selector before
dragging — not inferred from stacking multiple drags onto the same pair.
The player builds the full structure by hand (every atom placed
individually, including every hydrogen) and explicitly presses **Submit**
to check the result against the mission's target molecule; there is no
auto-complete.

---

## 1. What the game is about

- **Slug**: `carbon-builder`
- **Title**: Carbon Builder
- **Subject**: `chemistry`
- **Topic ID**: `molecular-bonding` *(placeholder — confirm against real
  topic taxonomy before seeding)*
- **Subtopic ID**: `tetravalency` *(placeholder)*
- **One-sentence pitch**: Given a target molecule, the player drags atoms
  onto a build surface and bonds them together by hand, constrained the
  whole time by each atom's real maximum bond capacity — most importantly
  carbon's four.
- **What concept does this reinforce?**: Carbon's tetravalency (always
  exactly 4 bonds) and, in later missions, how single/double/triple bonds
  and branching change how many hydrogens a structure needs.
- **Why does the mechanic teach that concept well?**: The 4-bond limit
  isn't a fact to memorize — it's a hard constraint the player runs into
  physically. Overfilling and getting rejected (the red flash) is more
  durable than reading "carbon has 4 bonds" in a textbook.

---

## 2. Content

**Engine: `molecule-builder` (new)**

### Atom roster (needed — doesn't exist in any current dataset)

Each atom needs, at minimum: symbol, display name, **max bond
capacity**, and a color (for the existing visual style — see
`bond-match`'s per-element hex convention). Neither `elementData.ts`
(tile-match) nor `bondData.ts` (bond-match) currently stores bond
capacity, since neither engine needs it — this is new content specific to
this engine.

| Symbol | Name | Max bonds |
|---|---|---|
| C | Carbon | 4 |
| H | Hydrogen | 1 |
| O | Oxygen | 2 |
| Cl | Chlorine | 1 |

*(Extend this table as later missions need more atoms — e.g. N for
amines, if that's ever in scope. Keep it minimal for the first mission
set: methane only needs C and H.)*

### Bond types

- `single` — counts as 1 toward each bonded atom's capacity
- `double` — counts as 2 toward each bonded atom's capacity *(Hard tier)*
- `triple` — counts as 3 toward each bonded atom's capacity *(Hard tier,
  if in scope — confirm against mission list below; the description
  mentions double bonds explicitly via ethene, triple bonds are listed
  under Hard but no example molecule is named yet — see Open Questions)*

Player selects the bond type via a distinct tool/selector before
dragging a connection (per your decision) — the data model should treat
bond order as a property of the connection itself, set at creation time,
not inferred or upgradable after the fact.

### Mission target shape

Each mission needs a target molecular structure: which atoms, how many of
each, and exactly how they're bonded (including bond order). This is what
Submit validates against — the player's built structure must match the
target's bond graph (right atoms, right bond count per atom, right bond
orders), not just have the right atom counts.

---

## 3. Quick Concepts snapshot

Draft set — refine wording once the actual UI copy pass happens:

| Card title | Body |
|---|---|
| How to Play | Drag atoms onto the build surface. Drag between two atoms to bond them. Hit Submit when you think you're done. |
| Carbon's Rule | Carbon always makes exactly 4 bonds — never more, never fewer. Watch the counter on each carbon. |
| Filling the Rest | After carbon's other bonds are placed, hydrogen fills whatever's left. |
| Double & Triple Bonds | Some bonds count for more than one slot. A double bond uses 2 of carbon's 4 slots by itself. |
| Stuck? Use a Hint | Tap Hint to see which bonds are still missing — it won't place them for you. |

---

## 4. Difficulty levels

This game is **level-based** (discrete missions with real content
differences), not a single difficulty-scaled session — same pattern as
Atom Forge, not Element Hunter. Difficulty tier and mission list are the
same thing here.

- **Easy**:
  - Single carbon (methane only)
  - Single bonds only
- **Medium**:
  - Multiple carbons, chained (ethane → propane → butane → pentane)
  - Still single bonds only
- **Hard**:
  - Double bonds (ethene)
  - Triple bonds *(needs a named target molecule — see Open Questions)*
  - Branched chains

| Mission | Tier | Target molecule | What's new |
|---|---|---|---|
| 1 | Easy | Methane (CH₄) | Single carbon, 4 single bonds, capacity limit introduced |
| 2 | Medium | Ethane (C₂H₆) | C–C bond counts as 1 of carbon's 4; remaining slots fill with H |
| 3 | Medium | Propane (C₃H₈) | 3-carbon chain |
| 4 | Medium | Butane (C₄H₁₀) | 4-carbon chain |
| 5 | Medium | Pentane (C₅H₁₂) | 5-carbon chain |
| 6 | Hard | Ethene (C₂H₄) | Double bond between the two carbons |
| 7 | Hard | *(triple-bond target — TBD)* | Triple bond |
| 8 | Hard | *(branched-chain target — TBD)* | Branching, e.g. isobutane |

---

## 5. Background illustration / environment

- **Desktop image path**: `/mascot/scene-carbon-builder.png` *(asset not
  yet produced)*
- **Mobile image path**: same as desktop until a dedicated crop exists
- **Mood/setting description**: A molecular workbench / lab-bench
  framing — consistent with Atom Forge's "laboratory" world, since this
  is conceptually a sibling game (build-something-correctly chemistry),
  not a different world.
- **Accent color**: `var(--eg-subject-chemistry)`

---

## 6. Card art + description

- **Card art path**: not yet produced — reuse `atom-forge`'s card art as
  placeholder (`/mascot/card-atom-forge.svg`) per the existing fallback
  convention, and flag for replacement before featuring.
- **Card description**: "Drag atoms together and build real molecules —
  one bond at a time, within carbon's strict 4-bond limit."

---

## 7. Mission Briefing flavor line

> "Welcome, Scientist. The lab needs working molecules, not loose atoms —
> bond them correctly, respecting every element's bonding limit, or the
> structure won't hold."

---

## 8. Subject metadata

N/A — chemistry already exists in `subjects.ts`.

---

## 9. Missions

See the table in Section 4 for the full list and tier mapping. Per
mission, still needed once content is finalized:
- Mission key (slug, e.g. `carbon-builder-methane`)
- XP reward
- Learning goal (one sentence)
- Estimated minutes

---

## 10. Mission Objectives checklist

New engine, so this needs its own entry in
`lib/content/missionObjectives.ts` (keyed by `molecule-builder`, not
inherited from anything existing):

- "Drag atoms onto the build surface and bond them together."
- "Respect every atom's maximum bond count — watch the counters."
- "Hit Submit when your structure matches the target."

---

## 11. Open questions / unresolved decisions

- **Resolved — locked by you before this build:**
  - Submit is an explicit button; no auto-complete. ✅
  - Player places every atom by hand, including every hydrogen — no
    auto-fill. ✅
  - Bond type (single/double/triple) is chosen via a distinct
    tool/selector before dragging, not inferred by stacking drags. ✅

- **Resolved — design calls made during the build (Senior Designer
  decisions, documented here so they're visible, not silent):**
  - **Triple-bond molecule**: Ethyne / Acetylene (C₂H₂), Mission 7.
  - **Branched-chain molecule**: Isobutane / 2-Methylpropane (C₄H₁₀),
    Mission 8 — chosen specifically because it shares butane's exact
    formula while being a structurally distinct molecule, which makes
    the branching lesson concrete rather than abstract.
  - **Wrong-Submit feedback**: specific, not generic — e.g. "Carbon only
    has 3 of 4 bonds filled," naming the actual atom and its real
    current/max count. Mirrors particle-assembly's existing
    `buildFeedback` pattern.
  - **Scoring model**: fixed XP per mission on a correct submit;
    attempts are tracked (`attemptsBeforeSuccess`) but never penalize
    XP — same shape as `ParticleAssemblyOutcome`, consistent with the
    platform's "no punishment, only guidance" mascot philosophy.
  - **Multi-carbon chain layout**: slot-based, not freeform drag
    physics. Each mission defines a small fixed set of named slots (a
    horizontal carbon backbone with branch/hydrogen stubs above and
    below); the player drags atoms onto open slots rather than nudging
    them to arbitrary pixel positions. Chosen because freeform placement
    of a 5-carbon pentane chain on a touch screen is a UX tax with
    nothing to do with the actual chemistry being taught — slots keep
    100% of the player's effort on bonding rules.
  - **Atom roster**: kept to C, H, O, Cl for this first mission set (O
    and Cl included ahead of any mission using them, per the spec's
    note not to build the dataset too narrow) — extend
    `atomRoster.ts`, not the engine, if a future mission needs another
    element.

- **Still open (post-build, before this ships to real players):**
  - Bespoke background/card art (currently placeholder — see Sections 5
    and 6).
  - Topic/subtopic ID values are placeholders pending confirmation
    against the real content taxonomy.
  - Per-mission XP values, sequence indices, and estimated minutes
    still need final numbers before DB seeding (engine and content are
    built and validated; these are content-tuning decisions, not
    technical blockers).

---

## 12. What was actually built (implementation record)

| File | Purpose |
|---|---|
| `src/engines/molecule-builder/moleculeBuilder.config.ts` | Zod schemas: `AtomDef`, `Slot`, `TargetBond`, shared config, mission payload |
| `src/engines/molecule-builder/moleculeBuilder.logic.ts` | Pure logic — `wouldOverfill`, `bondCountForSlot`, `checkStructure`, `buildFeedback` |
| `src/engines/molecule-builder/atomRoster.ts` | C/H/O/Cl atom dataset with real `maxBonds` |
| `src/engines/molecule-builder/carbonBuilderMissions.ts` | All 8 missions, hand-verified against real molecular formulas |
| `src/engines/molecule-builder/validateMissionContent.ts` | Content-authoring safety net — checks bond-graph correctness beyond what the schema alone catches |
| `src/engines/molecule-builder/MoleculeBuilderEngine.tsx` | The React runtime, built on `GameplayShell` |
| `src/engines/molecule-builder/MoleculeBuilderEngine.module.css` | Styling, matching `bond-match`'s visual language |
| `src/engines/registry.ts` | Added `molecule-builder` entry |
| `src/lib/content/gameEnvironments.ts`, `gameCardMeta.ts`, `missionBriefing.ts`, `quickConcepts.ts`, `missionObjectives.ts` | Content-layer entries for the `carbon-builder` slug, per this platform's New Game Spec Template |

**Verification performed before considering this done:**
- TypeScript compiled clean against the real `GameplayShell`, `Mascot`,
  `payoffSequence`, `playSound`, and `EnvironmentBackdrop` modules (not
  stubs) — zero errors, and confirmed the three pre-existing engines
  still compile unchanged (regression check).
- All 8 missions passed `validateMissionContent` (slot/target agreement,
  `bondableTo` symmetry, and exact bond-capacity-weight matching for
  every atom).
- All 8 missions and the shared config independently passed their real
  Zod schemas (`MoleculeBuilderMissionPayloadSchema`,
  `MoleculeBuilderSharedConfigSchema`), plus a negative test confirming
  a deliberately malformed mission is correctly rejected.
- 30-assertion gameplay stress test covering: correct methane build,
  the exact "5th bond on carbon gets rejected" scenario from the
  original brief, hydrogen's 1-bond limit, ethene's double-bond weight
  consuming 2 slots per carbon, specific wrong-submit feedback text, and
  isobutane's 3-neighbor branch-point carbon — all 30 passed.

