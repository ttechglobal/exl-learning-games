"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./upload.module.css";

// ── types ──────────────────────────────────────────────────────────────────────

type MainTab = "engine" | "missions" | "upload";

interface ParsedGame {
  slug: string; title: string; subject: string; engineType?: string;
  missions?: Array<{ missionKey: string; title: string; difficulty: string; xpReward: number; payload: Record<string, unknown> }>;
  accent_colour?: string; card_description?: string; pre_game_gradient?: string;
}

interface ValidationResult {
  ok: boolean; mode: "create" | "patch";
  game?: ParsedGame; errors: string[]; warnings: string[]; missionCount: number;
  fixedRaw?: string; cleanRaw?: string; fixes?: string[]; engineSpec?: Record<string, unknown>;
}

// ── form types ─────────────────────────────────────────────────────────────────
interface EngineForm {
  subject: string; topic: string; grade: string; term: string; description: string;
}

interface MissionForm {
  gameSlug: string; difficulty: string; count: string; context: string;
}

// ── constants ──────────────────────────────────────────────────────────────────
const SUBJECTS   = ["Mathematics", "Chemistry", "Physics", "Biology"];
const GRADES     = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","WAEC Year","JAMB Year"];
const TERMS      = ["First Term","Second Term","Third Term","All Year"];
const DIFFICULTIES = [
  { value: "EASY",    label: "Guided Learning",  sub: "Ms. Chidera explains every step. Full working shown. No blanks to fill.", colour: "#f5a623" },
  { value: "MEDIUM",  label: "Practice",         sub: "Coach gives a nudge, not the answer. Blanks to fill in working. Hearts.", colour: "#6c28e0" },
  { value: "HARD",    label: "Challenge",         sub: "Solve on paper first, then pick your answer. Blanks + MCQ final answer.", colour: "#e03c28" },
  { value: "MASTERY", label: "Mastery",           sub: "Exam-level. Application questions. No scaffolding at all.", colour: "#1a7a4a" },
  { value: "MIX",     label: "Mixed (all modes)", sub: "Balanced spread across Guided, Practice, Challenge, and Mastery.", colour: "#2563eb" },
];

const SUBJECT_META: Record<string, { colour: string; emoji: string }> = {
  mathematics: { colour: "#059669", emoji: "📐" },
  chemistry:   { colour: "#0284c7", emoji: "⚗️"  },
  physics:     { colour: "#7c3aed", emoji: "⚡"  },
  biology:     { colour: "#b45309", emoji: "🧬" },
};

// ── validation ─────────────────────────────────────────────────────────────────

/** Auto-fix common Claude output mistakes before validation */
function autoFix(parsed: Record<string, unknown>): { fixed: Record<string, unknown>; fixes: string[]; engineSpec?: Record<string, unknown> } {
  const fixed = { ...parsed };
  const fixes: string[] = [];

  // Extract __engineSpec if present — store it, remove from game JSON
  let engineSpec: Record<string, unknown> | undefined;
  if (fixed.__engineSpec && typeof fixed.__engineSpec === "object") {
    engineSpec = fixed.__engineSpec as Record<string, unknown>;
    delete fixed.__engineSpec;
    fixes.push("__engineSpec extracted and will be stored with the game");
  }

  // Gradient fields must be strings — Claude sometimes outputs arrays
  for (const field of ["pre_game_gradient", "game_gradient"] as const) {
    if (Array.isArray(fixed[field])) {
      fixed[field] = (fixed[field] as string[]).join(", ");
      fixes.push(`${field}: joined array → string`);
    }
  }

  // tiers[].tier must be "easy"|"medium"|"hard" strings — Claude sometimes outputs 0/1/2
  const tierMap: Record<number, string> = { 0: "easy", 1: "medium", 2: "hard" };
  if (Array.isArray((fixed as Record<string, unknown>).sharedConfig)) {
    // skip — not the right shape
  } else if (fixed.sharedConfig && typeof fixed.sharedConfig === "object") {
    const sc = fixed.sharedConfig as Record<string, unknown>;
    if (Array.isArray(sc.tiers)) {
      sc.tiers = (sc.tiers as Record<string, unknown>[]).map((t, i) => {
        if (typeof t.tier === "number") {
          const mapped = tierMap[t.tier as number] ?? ["easy","medium","hard"][i] ?? "easy";
          fixes.push(`sharedConfig.tiers[${i}].tier: ${t.tier} → "${mapped}"`);
          return { ...t, tier: mapped };
        }
        return t;
      });
    }
  }
  if (typeof fixed.accent_colour === "string" && fixed.accent_colour.startsWith('"')) {
    fixed.accent_colour = fixed.accent_colour.replace(/"/g, "");
    fixes.push("accent_colour: stripped extra quotes");
  }

  // missions[].sequenceIndex: ensure it's a number not a string
  if (Array.isArray(fixed.missions)) {
    fixed.missions = (fixed.missions as Record<string, unknown>[]).map((m, i) => {
      if (typeof m.sequenceIndex === "string") {
        fixes.push(`Mission ${i + 1}: sequenceIndex coerced to number`);
        return { ...m, sequenceIndex: parseInt(m.sequenceIndex as string, 10) };
      }
      return m;
    });
  }

  return { fixed, fixes, engineSpec };
}

function validate(raw: string): ValidationResult & { fixedRaw?: string; fixes?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Pre-process: strip /*__engineSpec ... */ comment block before JSON parse
  // This lets you paste Claude's complete output directly — spec + JSON together
  let engineSpecFromComment: Record<string, unknown> | undefined;
  let cleanRaw = raw;

  const specMatch = raw.match(/\/\*__engineSpec\s*([\s\S]*?)\*\//);
  if (specMatch) {
    try {
      engineSpecFromComment = JSON.parse(specMatch[1].trim());
      cleanRaw = raw.replace(specMatch[0], "").trim();
    } catch {
      // malformed spec comment — ignore and let JSON parse catch other issues
    }
  }

  // Also strip any leading/trailing non-JSON prose (markdown fences etc)
  const jsonStart = cleanRaw.indexOf("{");
  const jsonEnd   = cleanRaw.lastIndexOf("}");
  if (jsonStart > 0 || (jsonEnd !== -1 && jsonEnd < cleanRaw.length - 1)) {
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanRaw = cleanRaw.slice(jsonStart, jsonEnd + 1);
    }
  }

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(cleanRaw); }
  catch (e) { return { ok: false, mode: "create", errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [], missionCount: 0 }; }

  // Auto-fix known Claude output mistakes
  const { fixed, fixes, engineSpec: specFromField } = autoFix(parsed);
  const engineSpec = specFromField ?? engineSpecFromComment;
  if (engineSpecFromComment && !specFromField) fixes.push("Engine spec extracted from comment block — will be stored with the game");
  const cleanedJson = JSON.stringify(fixed, null, 2);
  const fixedRaw = fixes.length > 0 ? cleanedJson : undefined;
  // cleanRaw is always the stripped, spec-free JSON string — safe to parse
  cleanRaw = cleanedJson;
  parsed = fixed;

  const hasMissionsOnly = !parsed.title && !parsed.engineType && Array.isArray(parsed.missions);
  const mode: "create" | "patch" = hasMissionsOnly && Boolean(parsed.slug) ? "patch" : "create";

  if (!parsed.slug) errors.push("Missing: slug");
  const missions = Array.isArray(parsed.missions) ? parsed.missions as Record<string, unknown>[] : [];

  if (mode === "create") {
    if (!parsed.title)      errors.push("Missing: title");
    if (!parsed.engineType) errors.push("Missing: engineType");
    if (!parsed.subject)    errors.push("Missing: subject");
    if (!parsed.topicId)    errors.push("Missing: topicId");
    if (!parsed.sharedConfig && !parsed.shared_config) warnings.push("No sharedConfig — engine defaults will be used");
    if (missions.length === 0) warnings.push("No missions included — consider adding 6–10 starter missions for visualization.");
    // New engines not yet in the registry will be caught server-side with a clear message
    if (parsed.engineType && typeof parsed.engineType === "string") {
      const knownEngines = ["formula-excavation","stepwise-equation-solver","particle-assembly","molecule-builder","tile-match","bond-match","optics-experiment"];
      if (!knownEngines.includes(parsed.engineType)) {
        warnings.push(`Engine "${parsed.engineType}" is new — the game will be saved as a draft. A dev needs to build and register this engine in src/engines/registry.ts before it can be played. You can still add missions now.`);
      }
    }
  }
  if (mode === "patch" && missions.length === 0) errors.push("Patch: no missions found. Include a missions[] array.");

  missions.forEach((m, i) => {
    if (!m.missionKey) errors.push(`Mission ${i + 1}: missing missionKey`);
    if (!m.title)      errors.push(`Mission ${i + 1}: missing title`);
    if (!m.difficulty) errors.push(`Mission ${i + 1}: missing difficulty`);
    if (!m.payload)    errors.push(`Mission ${i + 1}: missing payload`);
  });

  return { ok: errors.length === 0, mode, game: parsed as unknown as ParsedGame, errors, warnings, missionCount: missions.length, fixedRaw, cleanRaw, fixes, engineSpec };
}

// ── prompt builders ────────────────────────────────────────────────────────────

function buildEngineIdeaPrompt(f: EngineForm): string {
  return `You are a senior Game Designer, Curriculum Expert and Learning Scientist for EXL Games.

═══════════════════════════════════════════════
WHAT EXL GAMES IS TRYING TO DO
═══════════════════════════════════════════════

EXL Games does not build games about learning topics.
EXL Games turns the learning itself into the game.

The distinction matters:

  ✗ "A space game where sometimes you answer maths questions"
  ✓ "The maths operation itself IS what you do with your hands"

The student should spend almost all of their time DOING the concept —
not reading about it, not answering questions about it, not watching it.

The core question that drives everything:
"How do we make the student physically perform the mathematical thinking?"

═══════════════════════════════════════════════
THE BRAINSTORMING METHOD
═══════════════════════════════════════════════

We do not start with game concepts.
We do not start with worlds, themes, or environments.
We start with the MENTAL OPERATIONS the student actually performs.

Step 1: Break the concept down into its cognitive steps.
Step 2: For each step, ask — what physical interaction could express this?
Step 3: Look for a coherent set of interactions that together form a gameplay loop.
Step 4: Only then consider a world or setting to give those interactions meaning.

The world exists to give the interaction stakes.
The interaction is never built around the world.

═══════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════

SUBJECT: ${f.subject || "[SUBJECT]"}
TOPIC: ${f.topic || "[TOPIC]"}${f.grade ? `\nGrade: ${f.grade}` : ""}${f.term ? `\nTerm: ${f.term}` : ""}${f.description ? `\n\nContext:\n${f.description}` : ""}

---

PHASE 1 — CONCEPT ANALYSIS (do this first, before any game ideas)

Break this topic down completely.

1.1 — MENTAL OPERATIONS
List every distinct cognitive action the student performs when doing this correctly.
Be specific and granular. Not "solve the equation" — but:
  • Identify what operation is applied to the target variable
  • Decide which inverse operation removes it
  • Apply that operation to both sides simultaneously
  • Observe the new state of the equation
  • Repeat until the variable is isolated

1.2 — COMMON MISTAKES
List the 4–6 most common errors students make on this topic.
These become the basis for distractors and feedback.

1.3 — WHAT DOES MASTERY LOOK LIKE?
Describe what a student who truly understands this can do,
that a student who is memorising a procedure cannot.

---

PHASE 2 — INTERACTION DESIGN (generate 5 ideas, not 10)

For each mental operation or cluster of operations identified above,
ask: "How could this become a physical interaction?"

Generate 5 interaction concepts. Each one should emerge directly
from the cognitive operations in Phase 1 — NOT from a theme or world.

For each concept:

**Interaction [N]: [Short name — describe the action, not the world]**

COGNITIVE ROOT
Which mental operation(s) from Phase 1 does this express?

PHYSICAL INTERACTION
What is on screen? (equation tiles / operation tokens / balance scales / etc.)
What does the player do? (drag / place / connect / split / rotate / etc.)
What does the system do in response?

ONE COMPLETE ROUND
Start state → player action → system response → repeat → win condition.
Write this as a sequence of moments, not a description.

WHAT MAKES IT FEEL GOOD
One sentence: why would this interaction be satisfying to repeat?

DIFFICULTY PROGRESSION
Practice: [how the system guides the student]
Challenge: [what support is removed, what the student must do alone]
Master:    [what makes this genuinely hard — the content, not the rules]

WORLD / SETTING (one sentence only)
A fictional context that gives these actions meaning and stakes.
The setting must not change what the player does — only why they care.

DISTRACTOR RISK
Which of the common mistakes from Phase 1 does this interaction
naturally reveal? (This tells us what the engine teaches, not just tests.)

---

PHASE 3 — EVALUATION

Rank the 5 interactions against these criteria:

| # | Name | Cognitive Fit | Physical Clarity | Scalability | Distractor Power | Total |
(Score each 1–5. Cognitive Fit = does the player perform the actual thinking? Physical Clarity = is the action immediately obvious? Scalability = can this support 50+ missions? Distractor Power = does a wrong move reveal a real misconception?)

Then write a SHORT RECOMMENDATION (3–4 sentences):
Which interaction would you develop first and why?
What would need to be designed carefully to make it work?

---

I will read Phase 1 carefully, then pick one interaction from Phase 2 to develop into a full engine.`;
}

function buildEngineJSONPrompt(f: EngineForm): string {
  return `You are a senior game designer, learning scientist and engineer for EXL Games.

═══════════════════════════════════════════════
THE EXL GAMES PRINCIPLE
═══════════════════════════════════════════════

Every curriculum concept deserves the engine that best represents
how experts actually think about it.

We do not ask: "Which existing engine can we reuse?"
We ask: "What is the best possible physical interaction for this concept?"

Every game gets its own engine — designed specifically for that game's
cognitive operations and physical interaction model.

This is deliberate. Each topic is different. Each game targets mastery
of one specific concept. The engine is the learning. It should be
designed without compromise.

THE NORTH STAR:
"What are the player's hands doing for 90% of the game?"
That answer defines the engine. Nothing else does.

═══════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════

SUBJECT: ${f.subject || "[SUBJECT]"}
TOPIC: ${f.topic || "[TOPIC]"}${f.grade ? `\nGrade: ${f.grade}` : ""}${f.term ? `\nTerm: ${f.term}` : ""}

--- CHOSEN INTERACTION CONCEPT ---
[PASTE THE INTERACTION YOU CHOSE FROM CHATGPT HERE]
--- END ---

═══════════════════════════════════════════════
STEP 1 — DEFINE THE ENGINE
═══════════════════════════════════════════════

Before writing any JSON, answer these four questions in writing.

Q1. THE HANDS SENTENCE
    One sentence, starting with "The player repeatedly..."
    This sentence IS the engine definition. Everything else follows from it.
    Example: "The player repeatedly drags operation tokens onto both sides
    of an equation until the target variable stands alone."

Q2. THE LOOP
    One complete round, written as a causal chain:
    [start state] → [player action] → [system response] → [new state]
    → [player repeats] → [win condition]

Q3. THE ENGINE IDENTITY
    Assign this engine:
    - engineType slug: kebab-case, describes the INTERACTION not the topic
      ✓ "operation-drag"  "balance-scale"  "particle-placer"  "circuit-tracer"
      ✗ "maths-game"  "formula-game"  "equation-tool"
    - A new primitive category name if this interaction pattern is genuinely new

Q4. THE FULL CONTRACT
    Define exactly what the engine needs to run:

    OBJECTS ON SCREEN
      List every element the student can see and interact with.

    PLAYER ACTIONS
      List every gesture and what the system does in response.
      drag [X] onto [Y] → [what happens]
      tap [X] → [what happens]
      etc.

    SCAFFOLDING PER PHASE
      Practice: what does the system do to guide the student?
      Challenge: what is removed? what stays available on request?
      Master: student works entirely alone — what makes it genuinely hard?

    PAYLOAD CONTRACT
      What fields does each mission need? Define field names and types.
      Example:
        formula: string          — the starting equation
        targetVariable: string   — the variable to isolate
        steps: Step[]            — each step the student must perform
        stepHints: string[][]    — 3 hints per step
        stepDistractors: Op[][]  — 3 distractors per step

    SHAREDCONFIG CONTRACT
      What does the engine config need? Define field names and types.
      Example:
        entry: { title: string, missionLabel: string }
        tiers: [{ tier: "easy"|"medium"|"hard", xpReward: number, hintAfterAttempts: number }]
        feedback: { correct: string[], invalid: string, success: string }
        scoring: { ... }

    REUSABLE FOR
      List 3+ other curriculum topics that could run on this same engine.
      This confirms the engine is a genuine interaction primitive,
      not a one-off solution.

This output is the developer build spec for this engine.
It becomes a build ticket. Be precise enough to implement from.

═══════════════════════════════════════════════
STEP 2 — BUILD THE JSON
═══════════════════════════════════════════════

Using the contracts you defined in Step 1, build the complete game JSON.

{
  "slug": "...",              ← kebab-case, unique, e.g. "formula-forge"
  "title": "...",             ← creative, memorable, reflects the world
  "engineType": "...",        ← the slug from Q3 above
  "subject": "${f.subject?.toLowerCase() || "..."}",
  "topicId": "...",           ← kebab-case topic, e.g. "change-of-subject"
  "progressionMode": "trackMap",
  "accent_colour": "...",     ← hex, unique to THIS game's visual identity
  "card_description": "...",  ← max 12 words, shown on game shelf
  "pre_game_gradient": "...", ← single CSS string — NEVER an array
  "game_gradient": "...",     ← single CSS string — NEVER an array
  "mission_briefing": "...",  ← 3–4 sentences, Nova's voice, world + stakes ONLY
                                 zero mechanics explanation — the interaction teaches itself
  "mission_objectives": {
    "brief": "...",
    "items": ["...", "...", "..."]
  },

  "sharedConfig": {
    /* Implement the SHAREDCONFIG CONTRACT from Step 1 exactly.
       The tiers array MUST use string values:
         { tier: "easy",   xpReward: 20, ... }
         { tier: "medium", xpReward: 40, ... }
         { tier: "hard",   xpReward: 75, ... }
       ⚠ tier MUST be the string "easy"/"medium"/"hard" — NEVER a number

       ALL feedback, hint, and review strings must use this game's
       specific metaphor language. Never "Correct!" or "Great job!" —
       those strings have no connection to what the student just did.
       Write feedback that describes what actually happened in the game world.
    */
  },

  "snapshot": {
    "cards": [
      /* THE LEARN PHASE — shown once before the student's very first mission.
         Students can return at any time. This is their reference, not a lecture.

         5–6 cards MAX. Each card must be SHORT and VISUAL.

         Each card: { "title": "...", "body": "...", "visual": "..." }

         BODY: 2–3 sentences ONLY. Short. Clear. One idea per card.
         No long explanations. A student should read each card in under 20 seconds.

         MATHEMATICAL STEPS IN THE BODY must be written like a teacher writes
         on a board — each step on its own line, clearly showing the progression:

         Example (do this):
           "To make r the subject of A = πr², divide both sides by π:\n\n
            A = πr²\n
            A ÷ π = r²\n
            √(A/π) = r\n\n
            The inverse of squaring is square root — always apply it last."

         NOT like this (do not do this):
           "You need to divide both sides by π and then take the square root of
            both sides to get r on its own."

         Every worked example must show:
           Line 1: the original formula
           Line 2+: each operation applied, one per line, with the result after
           Final line: the isolated variable with = on the left

         VISUAL: an inline SVG string illustrating the concept on that card.
         Size: viewBox="0 0 280 160". Dark background (#0d1520). Clean lines.
         Use the game's accent_colour for highlights.
         Show the maths visually — equation steps, arrows between lines,
         a balance scale, or a before/after diagram. Not abstract art.

         Order: core concept → worked example (with board-style steps) → common mistake → tip
      */
    ]
  },

  "missions": [
    /* EXACTLY 2 STARTER MISSIONS.
       Purpose: confirm the engine works. Visualise the game.
       Full mission sets are generated separately in the Mission Generator tab.

       Mission 1: EASY / stage "practice"
         → Simple content, 1–2 steps
         → System guides the student through each action
         → Student confirms or can attempt first

       Mission 2: MEDIUM / stage "challenge"
         → Moderate content, 2–3 steps
         → Student works independently
         → Hints available on request only — nothing auto-surfaces

       STAGE VALUES: "practice" | "challenge" | "master" — nothing else

       HINTS AND DISTRACTORS — author both for every mission.
       The engine controls when they surface. Always include them.

       DISTRACTOR RULE — each distractor must be a named real student error:
         sign error / wrong order / one-side only / inverse confusion / variable confusion

       CURRICULUM VERIFICATION — mentally apply every step before including a mission.
       If the steps don't produce the correct result, regenerate it.

       {
         "missionKey":    "w1-001",      ← w1=Practice w2=Challenge w3=Master
         "title":         "World 1 · Mission 1 — [Name]",
         "difficulty":    "EASY",        ← EASY | MEDIUM | HARD
         "sequenceIndex": 1,             ← INTEGER — 1 then 2, never a string
         "xpReward":      20,            ← 20 | 40 | 75
         "topicId":       "...",
         "learningGoal":  "one precise sentence",
         "payload": {
           /* ══ PAYLOAD CONTRACT ══

              FOR stepwise-equation-solver (simultaneous equations, change of subject):
              Each mission payload must have a "steps" array. Every step MUST have:

              {
                "lbl": "Step 1 — Eliminate y",          ← shown in stage card header
                "beats": [["Coach speech", "mood"],...], ← sequential coach messages
                "stageLines": [[{"t":"x + y = 8"}],      ← equation token rows
                               [{"t":"x − y = 2"}]],    ← multiple rows for stacked eqs

                ONE of these three action types:
                "ops": [{"l":"Add both equations","s":"+","correct":true},   ← operation buttons
                        {"l":"Subtract","s":"−","correct":false,"note":"..."}],

                "isOpts": true,                                               ← value pick
                "opts": [{"l":"5","c":true},{"l":"4","c":false,"n":"..."}],

                "isMulti": true,                                              ← term-by-term
                "termIndices": [0, 2, 4],
                "lockLabels": ["2x", "0", "10"],
                "multiSpeeches": [["What does x+x become?","Your guide"],...],
                "multiOpts": [[{"l":"2x","c":true},{"l":"x","c":false,"n":"..."}],...],

                "trailLabel": "Added both equations",   ← shown in solution trail
                "trailDetail": "x + x + y − y = 8 + 2",
                "resultText": "x + x + y − y = 8 + 2", ← revealed in stage after correct
                "afterSpeech": "Now simplify."          ← coach says this after correct
              }

              FOR formula-excavation: operation values MUST be one of:
              "divide_both" | "multiply_both" | "subtract_both" | "add_both" |
              "square_root" | "square_both" | "cube_root" | "cube_both"
              — nothing else. */
         }
       }
    */
  ]
}

REUSABLE FOR — list exactly 3 other curriculum topics this engine could serve.
This confirms the engine is a genuine interaction pattern, not a one-off.
Example: "layer-peel could also serve: Kinematics (v=u+at), Ohm's Law (V=IR), Gas Laws (PV=nRT)"

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Output in this exact order:

1. A JSON object assigned to "__engineSpec" at the TOP of your output,
   BEFORE the opening { of the game JSON.
   This is stored in the database as the developer build ticket.
   Format:
   /*__engineSpec
   {
     "engineType": "...",
     "handsDefinition": "The player repeatedly...",
     "gameplayLoop": "...",
     "objects": [...],
     "actions": [...],
     "scaffolding": { "practice": "...", "challenge": "...", "master": "..." },
     "payloadContract": { ... },
     "sharedConfigContract": { ... },
     "reusableFor": ["Topic A", "Topic B", "Topic C"]
   }
   */

2. The complete game JSON

═══════════════════════════════════════════════
OUTPUT RULES — violations cause upload failure
═══════════════════════════════════════════════

1. Output the Step 1 engine spec as a comment block at the very top,
   before the opening { — this is the developer build ticket

2. sharedConfig.tiers[].tier: string "easy" / "medium" / "hard" — NEVER a number

3. pre_game_gradient / game_gradient: single CSS string — NEVER an array
   ✓ "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)"
   ✗ ["linear-gradient(135deg, #0f0c29 0%)", "#302b63 100%"]

4. sequenceIndex: integers 1 and 2 — never strings

5. stage: "practice" | "challenge" | "master" — nothing else

6. stepHints: exactly 3 strings per step [vague, guiding, near-answer]

7. stepDistractors: exactly 3 per step, each a named real student error

8. Feedback/hint/review strings: engine metaphor language only

9. card_art_url: always ""

10. Output valid JSON only — no prose, no markdown fences after the spec comment`;
}

function buildMissionIdeaPrompt(f: MissionForm, game?: { id: string; slug: string; title: string; subject?: string; topicId?: string }): string {
  const count = parseInt(f.count) || 20;
  const gameTitle = game?.title || f.gameSlug || "[GAME]";
  const gameSlug  = game?.slug  || f.gameSlug  || "[GAME_SLUG]";

  const diffLabel = DIFFICULTIES.find(d => d.value === f.difficulty)?.label ?? f.difficulty;
  const diffInstructions = f.difficulty === "MIX"
    ? `Generate a BALANCED MIX across all four learning modes (EASY/MEDIUM/HARD/MASTERY):
- Guided Learning (~${Math.round(count * 0.30)} missions, EASY): Ms. Chidera explains every step. Full intermediate working shown inline. No popup blanks to fill.
- Practice (~${Math.round(count * 0.30)} missions, MEDIUM): Coach gives a nudge question only. Student fills in blanks in working popup. Hearts shown. 2–3 steps.
- Challenge (~${Math.round(count * 0.25)} missions, HARD): Student solves on paper first, then picks final answer from 4 MCQ options. Must include answerChoices[]. Fallback to practice-style stepwise if 2 wrong picks. 3–4 steps.
- Mastery (~${Math.round(count * 0.15)} missions, MASTERY): Exam-level. Application questions. No scaffolding. 4–5 steps.`
    : f.difficulty === "EASY"
    ? `All missions are GUIDED LEARNING (difficulty: "EASY"):
- Ms. Chidera explains each step with full coach text
- Intermediate working lines shown inline in the solution trail after every step
- NO popup blanks for the first 2 questions — student just observes
- From question 3 onward: popup appears with blanks for the student to fill in
- workingLines: author 4–6 lines per step showing the full arithmetic
- Complexity: 2–3 steps. Clear starting equations. One technique at a time.
- Goal: build understanding. The student should be able to follow every line.`
    : f.difficulty === "MEDIUM"
    ? `All missions are PRACTICE (difficulty: "MEDIUM"):
- Coach shows choiceQuestion as a nudge — NOT the full answer
- Popup appears immediately after correct pick, showing all working lines
- Student must fill in blanks (1–2 per step) before continuing
- Wrong blank picks show feedback then re-enable buttons for retry
- Hearts: 3 per question. Wrong operation pick = lose 1 heart.
- workingLines: author 4–6 lines per step. 1–2 lines should have blank: {answer, options:[3 choices]}
- Complexity: 2–3 steps. Requires recognising which technique to apply.
- answerChoices: NOT required for practice mode.`
    : f.difficulty === "HARD"
    ? `All missions are CHALLENGE (difficulty: "HARD"):
- Student sees the equations and has 10 seconds to solve on paper
- Then picks the final answer from 4 MCQ options (answerChoices[] — REQUIRED)
- 2 wrong MCQ picks → fallback to practice-style stepwise with popup blanks
- workingLines: author 4–6 lines per step. 1–2 should have blank: {answer, options:[3 choices]}
- Complexity: 3–4 steps. May require multiplying equations before eliminating.
- REQUIRED: include answerChoices[] with exactly 4 options, one correct: true`
    : f.difficulty === "MASTERY"
    ? `All missions are MASTERY (difficulty: "MASTERY"):
- Exam-level application questions. No scaffolding. No popup. No coach hints.
- workingLines still authored but shown inline only — no blanks
- Complexity: 4–5 steps. Multi-technique problems. Word-problem contexts.
- Goal: exam readiness — student should not need any help`
    : `All missions are GUIDED LEARNING (EASY) by default.`;

  return `You are a Senior Curriculum Designer and Educator for EXL Games.

Your task is to generate high-quality game missions for Nigerian secondary school students.
These missions are NOT quiz questions. Each mission is one complete physical interaction
the student performs in the game — the engine handles the mechanics, you design the content.

ABOUT THE LEARN PHASE (snapshot.cards):
When Claude converts this to JSON, the learn cards must be SHORT and VISUAL.
Keep your explanations here clear and concise — 2–3 sentences per concept.
Claude will add SVG illustrations to each card. Do not write long paragraphs.

---

GAME: ${gameTitle} (slug: ${gameSlug})
DIFFICULTY: ${diffLabel}
NUMBER OF MISSIONS: ${count}
${f.context ? `\nADDITIONAL CONTEXT:\n${f.context}` : ""}

TIER INSTRUCTIONS:
${diffInstructions}

---

CURRICULUM STANDARDS — every mission must meet all of these:

1. DISTINCT content — no two missions may use the same starting equation, formula, or scenario
2. Authentic progression — complexity increases naturally within the tier
3. Mathematically accurate — every step must be correct; no shortcuts, no approximations
4. ALWAYS author stepHints and stepDistractors — the engine controls when they appear,
   not whether they exist in the data. Include them for every mission regardless of stage.

DISTRACTOR DESIGN (required for each step):
Each step needs exactly 3 distractors. Each distractor must:
  • Correspond to a real, named student error:
    - Sign error (added instead of subtracted, or vice versa)
    - Wrong order (trying to remove an inner layer before an outer one)
    - One-side error (applying operation to one side of equation only)
    - Inverse confusion (multiplying when should divide, or vice versa)
    - Variable confusion (operating on the wrong term)
  • Look genuinely plausible to a student who partially understands
  • Be distinct from the other two distractors in that step
  Name each distractor's error type explicitly.

HINT QUALITY (3 levels per step, required):
  Hint 1 — Vague: nudge thinking without revealing the action ("What is protecting the variable?")
  Hint 2 — Guiding: name the category of action needed ("You need to undo a multiplication")
  Hint 3 — Near-answer: almost give it away ("Divide both sides by the coefficient")

CURRICULUM VERIFICATION (required before including any mission):
  Mentally apply each step in order. Confirm the result isolates the target variable or
  reaches the goal equation. If the steps do not produce the correct result, discard and
  regenerate that mission before including it.

UNIQUENESS CHECK (required across all missions in this output):
  × No duplicate missionKeys
  × No duplicate sequenceIndex values
  × No two missions using the same starting content

---

FOR EACH MISSION:

**Mission [N]**
- missionKey: w1-001 format (w1=Practice, w2=Challenge, w3=Master; number sequentially)
- title: "World N · Mission N — [Descriptive Name reflecting the content]"
- difficulty: EASY / MEDIUM / HARD
- stage: "practice" / "challenge" / "master"
- xpReward: 20 (EASY) / 40 (MEDIUM) / 75 (HARD)
- learningGoal: one precise sentence — what specific skill does completing this build?
- Starting state: the exact formula / equation the student sees
- Player objective: what must the student achieve?
- Step-by-step solution: each step in order
    → operation applied
    → formula state after this step
    → why this is the correct move
- Distractors per step: 3 wrong operations, each with named error type
- Hints per step: Hint 1 / Hint 2 / Hint 3

---

Generate all ${count} missions now.
Verify each one mathematically before including it.;

Generate all ${count} missions now. Be thorough and specific.
This content will be reviewed before upload.`;
}

function buildMissionJSONPrompt(f: MissionForm, game?: { id: string; slug: string; title: string }): string {
  const gameSlug = game?.slug || f.gameSlug || "[GAME_SLUG]";
  const isCoS = gameSlug.includes("change-of-subject") || gameSlug.includes("cos-");

  return `You are a senior game engineer for EXL Games.
Convert the mission content below into a patch JSON to add missions to game "${gameSlug}".
Output ONLY the patch JSON — nothing else.

--- MISSION CONTENT ---
[PASTE MISSION CONTENT HERE]
--- END ---

${isCoS ? `
CHANGE-OF-SUBJECT ENGINE — output this exact structure:
{
  "slug": "${gameSlug}",
  "missions": [
    {
      "missionKey":    "cos-001",
      "title":         "Mission 1 — Simple Linear",
      "difficulty":    "EASY",
      "sequenceIndex": 1,
      "xpReward":      20,
      "topicId":       "change-of-subject-formula",
      "learningGoal":  "Student can isolate a variable from a simple one-step formula.",
      "payload": {
        "questions": [
          {
            "qLabel": "Make t the subject",
            "formula": "v = u + at",
            "finalAnswer": "t = (v - u) / a",
            "steps": [
              {
                "leftToks": [
                  {"type":"term","t":"u"},
                  {"type":"op","t":"+"},
                  {"type":"term","t":"at","b":true}
                ],
                "rightToks": [{"type":"term","t":"v"}],
                "mascot": "We want <strong>t</strong> alone. <strong>u</strong> is in the way.",
                "instPrac": "u is blocking at — subtract u from both sides.",
                "instChall": "Make t the subject · v = u + at",
                "hint": "The opposite of + u is - u.",
                "tileOk": "- u",
                "tilesNo": ["+ u", "÷ u"],
                "whyNot": {
                  "+ u": "Adding u makes it larger.",
                  "÷ u": "Dividing by u does not remove u."
                },
                "lqT": [{"type":"term","t":"u + at - u"}],
                "lAns": "at",
                "lWrong": ["a+t", "u·t"],
                "rqT": [{"type":"term","t":"v - u"}],
                "rAns": "v - u",
                "rWrong": ["v+u", "v/u"],
                "newLeft": [{"type":"term","t":"at"}],
                "newRight": [{"type":"term","t":"v - u"}]
              }
            ]
          }
        ]
      }
    }
  ]
}

TOKEN REFERENCE:
  {"type":"term","t":"2x"}           plain term
  {"type":"term","t":"at","b":true}  blocker (coral highlight — the thing blocking the variable)
  {"type":"frac","n":"A","d":"pi"}   fraction A/pi
  {"type":"frac","n":"x","d":"3","b":true}  fraction blocker
  {"type":"sqrt","inner":[...]}      square root — inner is array of tokens
  {"type":"op","t":"+"}             operator (=, +, -, etc.)

RULES:
1. lWrong and rWrong: exactly 2 wrong answers each
2. tilesNo: exactly 2 wrong tile labels
3. newLeft / newRight: equation state AFTER this step
4. b:true only on the current blocker token
5. difficulty: "EASY" | "MEDIUM" | "HARD"
6. sequenceIndex: integers, no gaps, continuing from last mission
` : `
STEPWISE-SOLVER ENGINE — use this EXACT structure for simultaneous equations and similar maths topics:
{
  "slug": "${gameSlug}",
  "missions": [
    {
      "missionKey":    "gl-001",
      "title":         "Case 001 — [Descriptive Name]",
      "difficulty":    "EASY",
      "sequenceIndex": 1,
      "xpReward":      20,
      "topicId":       "simultaneous-linear-equations",
      "subtopicId":    "elimination-method",
      "learningGoal":  "Student can identify which operation eliminates a variable.",
      "payload": {
        "equations": [
          {"id": "eq1", "display": "x + y = 7"},
          {"id": "eq2", "display": "x - y = 3"}
        ],
        "solutionSteps": [
          {
            "description":     "Add the two equations to cancel y",
            "operation":       "add",
            "resultDisplay":   ["2x = 10"],
            "targetVariable":  "y",
            "isFinal":         false,
            "workingLines": [
              {"text": "  x + y = 7"},
              {"text": "+ x − y = 3"},
              {"text": "─────────────"},
              {"text": "x + x = 2x,  y + (−y) = 0,  7 + 3 = ?",
               "blank": {"answer": "10", "options": ["8", "10", "12"]}}
            ]
          },
          {
            "description":    "Divide both sides by 2",
            "operation":      "solve",
            "resultDisplay":  ["x = 5"],
            "targetVariable": "x",
            "isFinal":        false,
            "workingLines": [
              {"text": "  2x = 10  →  x = 10 ÷ 2 = ?",
               "blank": {"answer": "5", "options": ["4", "5", "6"]}}
            ]
          },
          {
            "description":    "Substitute x = 5 into equation 1",
            "operation":      "substitute",
            "resultDisplay":  ["5 + y = 7", "y = 2"],
            "targetVariable": "y",
            "isFinal":        true,
            "workingLines": [
              {"text": "  x + y = 7,  put x = 5:"},
              {"text": "  5 + y = 7  →  y = 7 − 5 = ?",
               "blank": {"answer": "2", "options": ["1", "2", "3"]}}
            ]
          }
        ],
        "solution": {"variables": {"x": 5, "y": 2}},
        "caseHints": [
          "y terms are +y and −y — opposite signs. What happens when you add them?",
          "2x = 10 — divide both sides by 2.",
          "Substitute x = 5 into equation 1 to find y."
        ],
        "answerChoices": [
          {"label": "x = 5, y = 2", "correct": true},
          {"label": "x = 3, y = 4", "correct": false},
          {"label": "x = 4, y = 3", "correct": false},
          {"label": "x = 2, y = 5", "correct": false}
        ]
      }
    }
  ]
}

OPERATION VALUES (use exactly these strings):
  "add"          — add both equations together
  "subtract"     — subtract one equation from the other
  "multiply_eq1" — multiply equation 1 by a factor (add multiplyFactor: N)
  "multiply_eq2" — multiply equation 2 by a factor (add multiplyFactor: N)
  "solve"        — divide/isolate a single variable
  "substitute"   — substitute a known value back in

WORKING LINES RULES:
- Author 3–6 lines per step showing the full arithmetic
- For blanks: the "?" in text marks where the answer goes
- blank.options: exactly 3 plausible options including the correct one
- Guided (EASY): all blanks included but popup only fires from question 3 onward
- Practice (MEDIUM): 1–2 blanks per step — student fills them in the popup
- Challenge (HARD): same as practice + must include answerChoices[]
- Mastery (MASTERY): workingLines present, blank field OMITTED (no popup)

ANSWER CHOICES (required for HARD/Challenge only):
- Exactly 4 options
- Exactly one has "correct": true
- Include realistic distractors (swapped x/y, sign errors, off-by-one)

SEQUENCE INDEX:
- gl-001, gl-002… = Guided (EASY), sequenceIndex 1, 2, 3…
- pr-001, pr-002… = Practice (MEDIUM), sequenceIndex 5, 6, 7… (continuing after guided)
- ch-001, ch-002… = Challenge (HARD), sequenceIndex 9, 10, 11…
- ms-001, ms-002… = Mastery (MASTERY), sequenceIndex 13, 14, 15…
`}

UNIVERSAL RULES:
- Output valid JSON only — no prose, no markdown fences
- pre_game_gradient / game_gradient: single CSS string, NEVER an array
- missionKey: no duplicates`;
}

// ── upload handler ─────────────────────────────────────────────────────────────

async function doUpload(
  raw: string,
  validation: ValidationResult,
  existingGames: Array<{ id: string; slug: string; title: string }>,
  setUploading: (v: boolean) => void,
  setUploadError: (v: string | null) => void,
  setUploadResult: (v: string | null) => void,
  router: ReturnType<typeof useRouter>
) {
  if (!validation?.ok || !validation.game) return;
  setUploading(true); setUploadError(null); setUploadResult(null);
  try {
    // cleanRaw is always the stripped, spec-free JSON — safe to parse even if
    // the user pasted Claude's full output including the /*__engineSpec*/ block
    const bodyObj = JSON.parse(validation.cleanRaw ?? validation.fixedRaw ?? raw);
    if (validation.engineSpec) bodyObj.__engineSpec = validation.engineSpec;
    const body = JSON.stringify(bodyObj);
    if (validation.mode === "patch") {
      const existing = existingGames.find(g => g.slug === validation.game!.slug);
      if (!existing) { setUploadError(`No game found with slug "${validation.game.slug}".`); setUploading(false); return; }
      const res  = await fetch(`/api/games/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) { setUploadError(json.error ?? `Server error ${res.status}`); setUploading(false); return; }
      setUploadResult(`✓ Added ${json.missionsAdded} mission${json.missionsAdded !== 1 ? "s" : ""} to "${existing.title}".${json.missionsSkipped > 0 ? ` ${json.missionsSkipped} skipped (already exist).` : ""}`);
      setTimeout(() => router.push(`/admin/games/${existing.id}/missions`), 1500);
    } else {
      const res  = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) { setUploadError(json.error ?? `Server error ${res.status}`); setUploading(false); return; }
      if (json.enginePending) {
        setUploadResult(`✓ Game "${json.game.title}" saved as draft. Engine "${json.game.engine_type}" needs to be registered in src/engines/registry.ts before it can be played. Missions can still be added now.`);
        setTimeout(() => router.push(`/admin/games/${json.game.id}/missions`), 2500);
      } else {
        router.push(`/admin/games/${json.game.id}/missions`);
      }
    }
  } catch (e) { setUploadError((e as Error).message); setUploading(false); }
}

// ── sub-components ─────────────────────────────────────────────────────────────

function PromptCard({ step, title, colour, desc, prompt, copiedKey, onCopy }: {
  step: string; title: string; colour: string; desc: string;
  prompt: string; copiedKey: string; onCopy: (key: string, text: string) => void;
}) {
  return (
    <div className={styles.promptCard}>
      <div className={styles.promptCardBar} style={{ background: colour }} />
      <div className={styles.promptCardInner}>
        <div className={styles.promptCardHeader}>
          <div>
            <div className={styles.promptCardStep} style={{ color: colour }}>{step}</div>
            <div className={styles.promptCardTitle}>{title}</div>
            <div className={styles.promptCardDesc}>{desc}</div>
          </div>
          <button
            onClick={() => onCopy(step, prompt)}
            className={styles.copyBtn}
            style={copiedKey === step ? { borderColor: colour, color: colour } : {}}
          >
            {copiedKey === step ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <pre className={styles.promptPreview}>{prompt.slice(0, 240)}…</pre>
      </div>
    </div>
  );
}

function UploadArea({ existingGames }: { existingGames: Array<{ id: string; slug: string; title: string }> }) {
  const router = useRouter();
  const [raw, setRaw]                   = useState("");
  const [validation, setValidation]     = useState<ValidationResult | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [dragging, setDragging]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => {
    setRaw(value); setUploadError(null); setUploadResult(null);
    if (value.trim().length < 5) { setValidation(null); return; }
    setValidation(validate(value));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const t = ev.target?.result as string; setRaw(t); handleChange(t); };
    reader.readAsText(file);
  };

  const g           = validation?.game;
  const subjectMeta = g?.subject ? (SUBJECT_META[g.subject] ?? { colour: "#64748b", emoji: "📖" }) : null;
  const accent      = g?.accent_colour ?? subjectMeta?.colour ?? "#64748b";
  const byDiff      = g?.missions?.reduce((acc: Record<string, number>, m) => { acc[m.difficulty] = (acc[m.difficulty] ?? 0) + 1; return acc; }, {}) ?? {};
  const isPatch     = validation?.mode === "patch";

  return (
    <>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ""}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className={styles.dropzoneIcon}>⬆</div>
        <div className={styles.dropzoneText}>
          Drop a <code>.json</code> file here or <span className={styles.dropzoneBrowseText}>browse</span>
        </div>
        <div className={styles.dropzoneHint}>Engine JSON (new game) or patch JSON (missions only)</div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const t = ev.target?.result as string; setRaw(t); handleChange(t); }; r.readAsText(f); }} />
      </div>

      <textarea
        id="exl-upload-textarea"
        className={styles.jsonArea}
        value={raw}
        onChange={e => handleChange(e.target.value)}
        onInput={e => handleChange((e.target as HTMLTextAreaElement).value)}
        placeholder="Or paste JSON here — Claude's complete output (including the /*__engineSpec*/ block is fine), engine JSON to create a new game, or { slug, missions[] } to add missions to an existing game…"
        spellCheck={false}
      />

      {validation && (
        <div className={styles.validationBox}>
          <div className={styles.validationHeader}>
            <div className={`${styles.validationStatus} ${validation.ok ? styles.validationOk : styles.validationErr}`}>
              {validation.ok ? "✓ Valid" : "✗ Errors"}
            </div>
            <div className={styles.validationMode}>
              {isPatch
                ? `Patch — adding ${validation.missionCount} mission${validation.missionCount !== 1 ? "s" : ""} to existing game`
                : `New game — ${validation.missionCount} mission${validation.missionCount !== 1 ? "s" : ""} included`}
            </div>
          </div>

          {g && (
            <div className={styles.previewCard} style={{ "--accent": accent } as React.CSSProperties}>
              <div className={styles.previewAccent} style={{ background: accent }} />
              <div className={styles.previewBody}>
                <div className={styles.previewTitle}>{g.title || g.slug}</div>
                {g.card_description && <div className={styles.previewDesc}>{g.card_description}</div>}
                <div className={styles.previewMeta}>
                  {g.subject && <span className={styles.previewTag}>{(SUBJECT_META[g.subject] ?? {}).emoji} {g.subject}</span>}
                  {g.engineType && <span className={styles.previewTag}>⚙ {g.engineType}</span>}
                  {isPatch && <span className={styles.previewTag} style={{ color: "#7c3aed" }}>Patch</span>}
                </div>
                {Object.keys(byDiff).length > 0 && (
                  <div className={styles.previewDiffs}>
                    {[
                      {key:"EASY",    label:"guided",    colour:"#f5a623"},
                      {key:"MEDIUM",  label:"practice",  colour:"#6c28e0"},
                      {key:"HARD",    label:"challenge",  colour:"#e03c28"},
                      {key:"MASTERY", label:"mastery",   colour:"#1a7a4a"},
                    ].map(({key,label,colour}) => byDiff[key] ? (
                      <span key={key} className={styles.previewDiff} style={{ color: colour }}>
                        {byDiff[key]} {label}
                      </span>
                    ) : null)}
                  </div>
                )}
              </div>
            </div>
          )}

          {validation.fixes && validation.fixes.length > 0 && (
            <div className={styles.valFixes}>
              ✦ Auto-fixed {validation.fixes.length} issue{validation.fixes.length !== 1 ? "s" : ""}:{" "}
              {validation.fixes.join(" · ")}
            </div>
          )}
          {validation.errors.map((e, i)   => <div key={i} className={styles.valError}>✗ {e}</div>)}
          {validation.warnings.map((w, i) => <div key={i} className={styles.valWarn}>⚠ {w}</div>)}
        </div>
      )}

      {uploadError  && <div className={styles.uploadMsg} data-type="error">✗ {uploadError}</div>}
      {uploadResult && <div className={styles.uploadMsg} data-type="success">{uploadResult}</div>}

      {validation?.ok && (
        <div className={styles.uploadActions}>
          <button
            onClick={() => doUpload(raw, validation, existingGames, setUploading, setUploadError, setUploadResult, router)}
            disabled={uploading}
            className={styles.uploadBtn}
          >
            {uploading ? "Uploading…"
              : isPatch
              ? `↑ Add ${validation.missionCount} Mission${validation.missionCount !== 1 ? "s" : ""}`
              : `↑ Create Game${validation.missionCount > 0 ? ` + ${validation.missionCount} Missions` : ""}`}
          </button>
          <p className={styles.uploadNote}>
            {isPatch
              ? "Missions with duplicate keys are skipped. New missions are appended."
              : "Game is created immediately. Missions can be added any time via patch."}
          </p>
        </div>
      )}
    </>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function UploadClient({ existingGames }: { existingGames: Array<{ id: string; slug: string; title: string }> }) {
  const [tab, setTab] = useState<MainTab>("engine");

  // Engine form
  const [ef, setEf] = useState<EngineForm>({ subject: "", topic: "", grade: "", term: "", description: "" });
  const setEField = (k: keyof EngineForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEf(f => ({ ...f, [k]: e.target.value }));

  // Mission form
  const [mf, setMf] = useState<MissionForm>({ gameSlug: "", difficulty: "MIX", count: "20", context: "" });
  const setMField = (k: keyof MissionForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setMf(f => ({ ...f, [k]: e.target.value }));

  // Selected game object for mission prompts
  const selectedGame = existingGames.find(g => g.slug === mf.gameSlug);

  // Engine spec draft — paste Claude's output here to save spec before uploading
  const [engineSpecDraft, setEngineSpecDraft] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const copyPrompt = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const engineFilled  = ef.subject || ef.topic;
  const missionFilled = !!mf.gameSlug;

  const TABS: { id: MainTab; label: string; icon: string }[] = [
    { id: "engine",   label: "Engine Design",     icon: "⚙" },
    { id: "missions", label: "Mission Generator",  icon: "◈" },
    { id: "upload",   label: "Upload JSON",        icon: "↑" },
  ];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <a href="/admin/games" className={styles.breadcrumbLink}>Games</a>
            <span className={styles.breadcrumbSep}>/</span>
            <span>Upload</span>
          </div>
          <h1 className={styles.heading}>Game Studio</h1>
          <p className={styles.sub}>Design the engine → generate missions → upload separately at your own pace.</p>
        </div>
      </div>

      {/* Main tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className={styles.tabIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ══ TAB: ENGINE DESIGN ══ */}
      {tab === "engine" && (
        <div>
          {/* Workflow */}
          <div className={styles.workflowBanner}>
            {[
              { n: "1", title: "Fill details", sub: "Topic, subject, grade" },
              { n: "2", title: "ChatGPT → 10 ideas", sub: "Pick the best concept" },
              { n: "3", title: "Claude → JSON", sub: "Engine + learn cards" },
              { n: "4", title: "Upload engine", sub: "Add missions later" },
            ].map((s, i, arr) => (
              <div key={s.n} className={styles.workflowRow}>
                <div className={styles.workflowStep}>
                  <div className={styles.workflowNum}>{s.n}</div>
                  <div>
                    <div className={styles.workflowTitle}>{s.title}</div>
                    <div className={styles.workflowSub}>{s.sub}</div>
                  </div>
                </div>
                {i < arr.length - 1 && <div className={styles.workflowArrow}>→</div>}
              </div>
            ))}
          </div>

          <div className={styles.promptLayout}>
            {/* Form */}
            <div className={styles.formPanel}>
              <div className={styles.formPanelTitle}>Game Details</div>

              <div className={styles.formRow2}>
                <label className={styles.fieldLabel}>
                  Subject *
                  <select className={styles.fieldSelect} value={ef.subject} onChange={setEField("subject")}>
                    <option value="">Select…</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  Grade / Year
                  <select className={styles.fieldSelect} value={ef.grade} onChange={setEField("grade")}>
                    <option value="">Select…</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              </div>

              <label className={styles.fieldLabel} style={{ display: "block", marginTop: 12 }}>
                Topic *
                <input className={styles.fieldInput} value={ef.topic} onChange={setEField("topic")} placeholder="e.g. Change of Subject of Formulae" />
              </label>

              <label className={styles.fieldLabel} style={{ display: "block", marginTop: 12 }}>
                Term
                <select className={styles.fieldSelect} value={ef.term} onChange={setEField("term")}>
                  <option value="">Select…</option>
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label className={styles.fieldLabel} style={{ display: "block", marginTop: 12 }}>
                Context / description
                <textarea className={styles.fieldTextarea} value={ef.description} onChange={setEField("description")}
                  placeholder="Optional: what students need to learn, exam board requirements, specific subtopics…" rows={4} />
              </label>

              {!engineFilled && <div className={styles.formHint}>Fill Subject and Topic to generate targeted prompts.</div>}
            </div>

            {/* Prompt cards */}
            <div className={styles.promptCards}>
              <PromptCard
                step="Step 1 — ChatGPT"
                title="Get 10 Engine Ideas"
                colour="#10b981"
                desc={engineFilled ? `10 interaction concepts for "${ef.topic || "your topic"}" — pick the best one.` : "Fill the form to generate a targeted prompt."}
                prompt={buildEngineIdeaPrompt(ef)}
                copiedKey={copiedKey}
                onCopy={copyPrompt}
              />
              <PromptCard
                step="Step 2 — Claude"
                title="Build the Engine JSON"
                colour="#7c3aed"
                desc="Paste your chosen concept. Claude decides engine fit and builds the full game JSON — no missions yet."
                prompt={buildEngineJSONPrompt(ef)}
                copiedKey={copiedKey}
                onCopy={copyPrompt}
              />
            </div>
          </div>

          {/* ── Engine Spec Box ─────────────────────────────────── */}
          <div className={styles.specBox}>
            <div className={styles.specBoxHeader}>
              <div>
                <div className={styles.specBoxTitle}>Step 3 — Paste Claude's Output Here</div>
                <div className={styles.specBoxSub}>
                  Paste Claude's complete response — including the <code className={styles.inlineCode}>/*__engineSpec*/</code> block and the JSON.
                  The spec is extracted and saved automatically. Then switch to Upload JSON to upload.
                </div>
              </div>
              <button
                className={styles.specBoxBtn}
                onClick={() => {
                  if (engineSpecDraft.trim()) {
                    setTab("upload");
                    // A tiny delay lets the tab switch render before we'd set state on UploadArea
                    // The user will paste into the upload area — we pre-populate via a custom event
                    setTimeout(() => {
                      const el = document.getElementById("exl-upload-textarea");
                      if (el && el instanceof HTMLTextAreaElement) {
                        el.value = engineSpecDraft;
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                      }
                    }, 80);
                  }
                }}
                disabled={!engineSpecDraft.trim()}
              >
                → Send to Upload
              </button>
            </div>
            <textarea
              className={styles.specBoxArea}
              value={engineSpecDraft}
              onChange={e => setEngineSpecDraft(e.target.value)}
              placeholder={`Paste Claude's complete output here, e.g:\n\n/*__engineSpec\n{\n  "engineType": "layer-peel",\n  "handsDefinition": "The player repeatedly...",\n  ...\n}\n*/\n\n{\n  "slug": "formula-forge",\n  "title": "Formula Forge",\n  ...\n}`}
              rows={12}
            />
            {engineSpecDraft.trim() && (() => {
              const hasSpec = engineSpecDraft.includes("/*__engineSpec");
              const hasJson = engineSpecDraft.includes("{");
              return (
                <div className={styles.specBoxStatus}>
                  {hasSpec && <span className={styles.specFound}>✓ Engine spec detected</span>}
                  {hasJson && <span className={styles.specFound}>✓ JSON detected</span>}
                  {!hasSpec && <span className={styles.specMissing}>⚠ No engine spec comment found — spec won't be saved</span>}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {tab === "missions" && (
        <div>
          <div className={styles.workflowBanner}>
            {[
              { n: "1", title: "Select game + level", sub: "Slug, difficulty, count" },
              { n: "2", title: "ChatGPT → mission content", sub: "Educator-quality problems" },
              { n: "3", title: "Claude → patch JSON", sub: "Structured for the engine" },
              { n: "4", title: "Upload patch", sub: "Missions added to game" },
            ].map((s, i, arr) => (
              <div key={s.n} className={styles.workflowRow}>
                <div className={styles.workflowStep}>
                  <div className={styles.workflowNum}>{s.n}</div>
                  <div>
                    <div className={styles.workflowTitle}>{s.title}</div>
                    <div className={styles.workflowSub}>{s.sub}</div>
                  </div>
                </div>
                {i < arr.length - 1 && <div className={styles.workflowArrow}>→</div>}
              </div>
            ))}
          </div>

          <div className={styles.promptLayout}>
            {/* Mission form */}
            <div className={styles.formPanel}>
              <div className={styles.formPanelTitle}>Mission Details</div>

              <label className={styles.fieldLabel} style={{ display: "block", marginBottom: 16 }}>
                Game *
                <select className={styles.fieldSelect} value={mf.gameSlug} onChange={setMField("gameSlug")}>
                  <option value="">Select game…</option>
                  {existingGames.map(g => <option key={g.id} value={g.slug}>{g.title}</option>)}
                </select>
              </label>

              {selectedGame && (
                <div className={styles.selectedGameBadge}>
                  ✓ {selectedGame.title}
                </div>
              )}

              {/* Difficulty selector */}
              <div style={{ marginTop: 16 }}>
                <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Difficulty Level</div>
                <div className={styles.diffSelector}>
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      className={`${styles.diffOption} ${mf.difficulty === d.value ? styles.diffOptionActive : ""}`}
                      style={mf.difficulty === d.value ? { borderColor: (d as {colour?: string}).colour ?? "#7c3aed", boxShadow: `0 0 0 2px ${(d as {colour?: string}).colour ?? "#7c3aed"}33` } : {}}
                      onClick={() => setMf(f => ({ ...f, difficulty: d.value }))}
                    >
                      <div className={styles.diffOptionLabel}>{d.label}</div>
                      <div className={styles.diffOptionSub}>{d.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count */}
              <label className={styles.fieldLabel} style={{ display: "block", marginTop: 16 }}>
                Number of missions
                <div className={styles.countRow}>
                  {["10","15","20","30","50"].map(n => (
                    <button key={n} type="button"
                      className={`${styles.countBtn} ${mf.count === n ? styles.countBtnActive : ""}`}
                      onClick={() => setMf(f => ({ ...f, count: n }))}
                    >{n}</button>
                  ))}
                  <input className={styles.countInput} type="number" value={mf.count}
                    onChange={e => setMf(f => ({ ...f, count: e.target.value }))} min="1" max="100" />
                </div>
              </label>

              <label className={styles.fieldLabel} style={{ display: "block", marginTop: 14 }}>
                Additional context
                <textarea className={styles.fieldTextarea} value={mf.context} onChange={setMField("context")}
                  placeholder="Optional: specific subtopics to cover, last sequenceIndex to continue from, common student errors to target, exam board focus…" rows={4} />
              </label>

              {!missionFilled && <div className={styles.formHint}>Select a game to generate mission prompts.</div>}
            </div>

            {/* Mission prompt cards */}
            <div className={styles.promptCards}>
              <PromptCard
                step="Step 1 — ChatGPT"
                title={`Generate ${mf.count || "20"} Missions`}
                colour="#10b981"
                desc={missionFilled
                  ? `${mf.count || "20"} ${mf.difficulty === "MIX" ? "mixed-level" : mf.difficulty.toLowerCase()} missions for ${selectedGame?.title ?? mf.gameSlug} — educator quality, exam-aligned.`
                  : "Select a game to generate a targeted mission prompt."}
                prompt={buildMissionIdeaPrompt(mf, selectedGame)}
                copiedKey={copiedKey}
                onCopy={copyPrompt}
              />
              <PromptCard
                step="Step 2 — Claude"
                title="Convert to Patch JSON"
                colour="#7c3aed"
                desc="Paste ChatGPT's mission content here. Claude converts it into the correct engine payload format ready to upload."
                prompt={buildMissionJSONPrompt(mf, selectedGame)}
                copiedKey={copiedKey}
                onCopy={copyPrompt}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: UPLOAD JSON ══ */}
      {tab === "upload" && (
        <div>
          <div className={styles.uploadTabHint}>
            <strong>Tip:</strong> You can paste Claude's complete output here — including the <code className={styles.hintCode}>/*__engineSpec*/</code> comment block. It will be extracted automatically.
          </div>
          <UploadArea existingGames={existingGames} />
        </div>
      )}
    </div>
  );
}