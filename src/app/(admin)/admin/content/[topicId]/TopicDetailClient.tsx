// FILE: src/app/(admin)/admin/content/[topicId]/TopicDetailClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./topic.module.css";
import ContentPreview from "./MobilePreview";
import InteractionSelector, { type InteractionRef } from "./InteractionSelector";
import { INTERACTION_REGISTRY } from "@/lib/interactions/registry";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BuildIntent {
  whatStudentDoes: string;
  whatSystemShows: string;
  coachOpeningLine: string;
  successLooks: string;
}

interface QuickCheckQuestion {
  question: string;
  correctAnswer: string;
  wrongAnswer1: string;
  wrongAnswer2: string;
  coachHint: string;
  objective: string;
}

interface ChallengeQuestion {
  question: string;
  correctAnswer: string;
  wrongAnswers: string[];
  reasoningPath: string;
  objective: string;
}

interface GuidedLearningMission {
  missionName: string;
  coachBriefing: string[];
  interaction: { whatStudentDoes: string; whatSystemShows: string; keyMoment: string };
  coachLines: { atKeyMoment: string; onSuccess: string };
  objectives: string[];
  misconceptionConfronted?: string;
  howInteractionConfrontsIt?: string;
}

interface Concept {
  name: string;
  stage: string;
  status: "not-started" | "build-intent" | "in-progress" | "built" | "approved";
  simplestTrueStatement?: string;
  misconception?: string;
  realWorldAnchor?: string;
  buildIntent?: BuildIntent;
  guidedLearningMission?: GuidedLearningMission;
  guidedPracticeNotes?: string;
  quickCheckQuestions?: QuickCheckQuestion[];
  challengeQuestions?: ChallengeQuestion[];
  interactionRef?: InteractionRef | null;
}

interface Topic {
  id: string;
  subject: string;
  name: string;
  level: string;
  curricula: string[];
  concepts: Concept[];
  misconceptions?: Array<{ belief: string; correction: string; stage: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<Concept["status"], { label: string; colour: string; next: Concept["status"] | null }> = {
  "not-started":  { label: "Not started",    colour: "#3a4455", next: "build-intent" },
  "build-intent": { label: "Intent written", colour: "#b45309", next: "in-progress"  },
  "in-progress":  { label: "In progress",    colour: "#7c3aed", next: "built"        },
  "built":        { label: "Built",          colour: "#0284c7", next: "approved"     },
  "approved":     { label: "Approved",       colour: "#059669", next: null           },
};

const SUBJECT_META: Record<string, { colour: string; coach: string }> = {
  chemistry:   { colour: "#0284c7", coach: "Dr. Adaobi"  },
  physics:     { colour: "#7c3aed", coach: "Prof. Emeka" },
  mathematics: { colour: "#059669", coach: "Ms. Chidera" },
  biology:     { colour: "#b45309", coach: "Dr. Adaobi"  },
};

function getMissing(c: Concept): string[] {
  const m: string[] = [];
  if (!c.guidedLearningMission) m.push("GL");
  if (!c.quickCheckQuestions?.length) m.push("PQ");
  if (!c.challengeQuestions?.length) m.push("CQ");
  return m;
}

function parseJSON(raw: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  let s = raw.trim();
  s = s.replace(/^```json?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return { ok: false, error: "No JSON object found. Paste Claude's complete response." };
  s = s.slice(start, end + 1);
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/,\s*([\]}])/g, "$1");
  try { return { ok: true, data: JSON.parse(s) }; }
  catch (e) { return { ok: false, error: `Parse error: ${(e as Error).message}` }; }
}

function buildPrompt(topic: Topic, concept: Concept, idx: number): string {
  const meta = SUBJECT_META[topic.subject] ?? { coach: "the coach" };
  const isMaths = topic.subject === "mathematics";
  const isGP = concept.stage === "Guided Practice";

  // Build dynamic interaction library listing
  const subjectInteractions = INTERACTION_REGISTRY.filter(i => i.subjects.includes(topic.subject));
  const interactionList = subjectInteractions.length > 0
    ? subjectInteractions.map(i => {
        const configKeys = i.configSchema.map(f => f.key).join(", ");
        return `- ${i.key}: ${i.description} | Config keys: ${configKeys}`;
      }).join("\n")
    : "- (none yet — if an interaction would help, describe what it should do)";

  return `You are a senior interactive learning designer for EXL Learning World.

TOPIC: ${topic.name}
SUBJECT: ${topic.subject.charAt(0).toUpperCase() + topic.subject.slice(1)}
LEVEL: ${topic.level}
CONCEPT ${idx + 1}: ${concept.name}
COACH: ${meta.coach}

CONCEPT STATEMENT: ${concept.simplestTrueStatement ?? ""}
REAL-WORLD ANCHOR: ${concept.realWorldAnchor ?? "(none)"}
MISCONCEPTION TO CONFRONT: ${concept.misconception ?? "(none)"}
BUILD INTENT:
- What student does: ${concept.buildIntent?.whatStudentDoes ?? "(not specified)"}
- What system shows: ${concept.buildIntent?.whatSystemShows ?? "(not specified)"}
- Success looks like: ${concept.buildIntent?.successLooks ?? "(not specified)"}

---

IMPORTANT — TWO SEPARATE RESPONSES REQUIRED:

Think about the lesson and the interaction together as one design
process. The interaction should influence the guided learning, practice,
and challenge — reason about both at the same time.

However, return your answer as TWO completely separate responses:

RESPONSE 1 — LESSON CONTENT ONLY
Return the JSON lesson package. This is what gets imported into the
application. It must include everything the application needs:
guided learning, coach cards, practice questions, challenge questions,
interaction reference. Do NOT include the interaction build prompt
in this response. Output this JSON first and stop.

Wait for confirmation, then continue with:

RESPONSE 2 — INTERACTION BUILD PROMPT ONLY
Return only the standalone interaction build prompt. This is NOT
imported into the application. It is copied directly into Claude or
ChatGPT to build the interaction component. It should be a complete,
self-contained specification a developer can build from with no other
document. Plain text — not JSON.

The reason for splitting: both responses together exceed output limits.
Reason about them together. Return them separately.

---

YOUR SINGLE OBJECTIVE:
Design the best interaction for teaching this concept, generate the
prompt required to build that interaction, then create the supporting
guided explanation, quick check, and challenge around it.

The interaction comes first. Everything else supports it.

The decision to use an interaction has already been made.
Do not question it. Do not suggest a text-only alternative.
Design the interaction.

SCIENTIFIC LANGUAGE — NON-NEGOTIABLE:
Do not reduce complexity. Clarity of delivery is not the same as
reduction of depth. These rules apply everywhere in your output:
- Keep all technical terms. Define them through interaction and
  context, not by replacing them with informal substitutes.
- Name the science: atoms, molecules, kinetic energy, intermolecular
  forces, lattice structure, sublimation — use these words correctly.
  The student learns the vocabulary by encountering it used precisely.
- Do not write "simply put" or "in simple terms." If simplification
  is needed, use an analogy or a concrete example — not imprecision.
- A student preparing for WAEC or IGCSE must encounter the same
  terminology in this lesson that will appear in their exam.

---

STEP 1 — DESIGN THE INTERACTION

Design an interaction that naturally teaches this concept.
The student discovers the concept by doing — not by reading.

Describe:
- interactionTitle: short, descriptive name
- learningObjective: what the student will understand by doing this
- studentGoal: what the student is trying to accomplish (in their terms)
- whatStudentSees: the opening visual state before they touch anything
- whatStudentCanDo: every action available — drag / tap / slide / rotate / sort / build
- interactionFlow: step-by-step sequence of what happens as student interacts
  Each step: student action → system response → concept revealed
- feedbackDuringInteraction: what the system shows as the student acts
  (not right/wrong judgement — live visual response to every action)
- completionCondition: exact condition that ends the interaction

The interaction precedes the explanation. The coach names what the
student already experienced — not what they are about to do.

---

STEP 2 — GENERATE THE INTERACTION BUILD PROMPT

Every interaction needs a dedicated build prompt for the developer.
This is not for the student. It is the blueprint for building the
interaction component inside the application.

The build prompt must fully specify:
- Educational objective (what concept this teaches and how)
- Interaction mechanics (every action the student can take)
- Visual layout (what occupies each area of the screen)
- All required objects (every element that appears — name, appearance, behaviour)
- Animations (what animates, how, at what speed, triggered by what)
- Drag-and-drop behaviour (if used: what is draggable, drop targets, snap behaviour)
- Click / tap behaviour (what responds to tap, what feedback appears)
- State changes (every state the interaction can be in, what triggers each)
- Success rules (exact condition — what must be true for completion)
- Failure / wrong-action rules (what happens when student does something incorrect)
- Feedback animations (visual response to correct and incorrect actions)
- SVG assets required (list every icon, object, illustration needed)
- Responsive behaviour (how layout adapts from 360px mobile to desktop)
- Accessibility requirements (touch targets minimum 44×44px, colour contrast, labels)

Write this as a complete self-contained specification that a developer
can build from with no clarifying questions.

---

STEP 3 — GUIDED EXPLANATION (coach cards)

After the interaction, the coach explains what the student just experienced.
The explanation reinforces the interaction — it does not replace it.

Card sequence:
- Card 1: Real-world hook connected to the interaction. No concept name yet.
  Use the REAL-WORLD ANCHOR provided above if one is given.
  If not given, choose something universally recognisable — food, weather,
  the body, everyday objects anyone anywhere would know (chocolate melting,
  ice cream on a warm day, steam from a hot drink, a ball rolling downhill).
  Do not use examples that require a laboratory or specific cultural context.
  SHORT sentences. Plain words. 14-year-old level.
- Card 2: Name the concept. Connect it to what the student just did.
  "You just saw... This is called..."
- Card 3: The precise definition. Now they are ready for it.
- Card 4 (only if genuinely needed): Name and correct the main misconception.

Each card: 1–2 sentences maximum. One is often better than two.
Never textbook language. No visuals needed — the interaction already gave
the student the visual experience.

COACH VOICE RULES — follow all of these:
- Speak directly to the student ("you", "let's", "notice that")
- Never passive voice ("the particles are heated" → "you're heating those particles")
- Never say "as you can see", "basically", "it is important to note"
- Use analogies naturally — do not announce them ("think of it like...")
  Just use the analogy as the obvious way to say the thing
- Keep technical terms — define them through context, never replace them
  with informal substitutes ("intermolecular forces" stays, not "particles sticking")
- Name scientists and discoveries where relevant — Avogadro, Dalton,
  kinetic theory — these are part of the student's scientific vocabulary
- Acknowledge the counterintuitive: "I know this seems backwards — here's why it isn't"

The key moment line and completion line must be written in full — warm, specific,
scientifically precise. Not "great job!" — "You just moved those particles past
their melting point. That is exactly what heat does to every solid on Earth."

---

STEP 4 — QUICK CHECK QUESTIONS

Quick check questions are embedded at the end of the guided lesson —
they appear after the final coach card, before the completion screen.
The student answers right there without leaving the lesson. No navigation.

These are NOT practice questions. They are shorter, simpler recall checks
of what the student just experienced in the guided interaction above.
The student has just done the interaction — these questions confirm they
understood what they saw.

Purpose: immediate recall of the interaction just completed.
Number: exactly 2 questions. No more, no less.
Difficulty: recall or single-step application only.
Wrong answers must each be grounded in the specific misconception
listed above — not random filler. A student who has the misconception
should be genuinely tempted by the wrong option.

For each question:
- question: short, direct — tests one thing from what was just shown
- correctAnswer
- correctExplanation: 1–2 plain sentences written directly to the student.
  Confirm WHY it is right — the scientific reason, not just "correct!"
  Use the same precise language as the coach cards above.
- wrongAnswer1 + wrongAnswer1Explanation: name the misconception it targets
- wrongAnswer2 + wrongAnswer2Explanation: name the misconception it targets
- coachHint: a guiding nudge — teaches the concept, never gives the answer

---

STEP 5 — CHALLENGE QUESTIONS

Challenge questions are for students to come back to later.
They test application, not recall. Harder thinking required.
Maximum 3 questions. Plain text — no visuals needed.
Keep them short and sharp. Do not overcomplicate.

Challenge ≠ harder Practice. The student must reason, not remember.

For each question:
- question: unfamiliar scenario or application — student must think
- correctAnswer
- correctExplanation: 2–3 plain sentences. How to reason through this.
- wrongAnswers: 2–3 options grounded in real misconceptions
- wrongAnswerExplanations: one sentence each — why each is wrong

---

Produce the complete content spec. Respond ONLY with valid JSON. No preamble, no markdown fences.

{
  "concept": "${concept.name}",
  "interaction": {
    "interactionTitle": "short descriptive name",
    "learningObjective": "what the student understands by doing this",
    "studentGoal": "what the student is trying to accomplish, in their own terms",
    "whatStudentSees": "the opening state before any interaction",
    "whatStudentCanDo": ["drag / tap / slide / sort / build — one per action"],
    "interactionFlow": [
      { "step": 1, "studentAction": "what student does", "systemResponse": "what happens on screen", "conceptRevealed": "what the student discovers" },
      { "step": 2, "studentAction": "", "systemResponse": "", "conceptRevealed": "" }
    ],
    "feedbackDuringInteraction": "what the system shows as student acts — live response, not right/wrong judgement",
    "completionCondition": "exact condition that ends the interaction"
  },
  "guidedLearningMission": {
    "missionName": "engaging mission name — curious, not academic",
    "coachBriefing": [
      "Card 1: real-world hook using the anchor above — no concept name yet",
      "Card 2: name the concept, connect it to what the student just did",
      "Card 3: the precise scientific definition — now they are ready for it",
      "Card 4 (only if genuinely needed): correct the main misconception directly"
    ],
    "coachLines": {
      "atKeyMoment": "exact line ${meta.coach} says at the peak — warm and specific",
      "onSuccess": "exact completion line — names what the student now understands"
    },
    "objectives": ["The student can ...", "The student can ..."],
    "misconceptionConfronted": "${concept.misconception ?? ""}",
    "howInteractionConfrontsIt": "what makes the wrong belief impossible to hold after this"
  },
  "interactionRef": {
    "component": "ComponentNameIfExists",
    "config": {},
    "componentExists": false,
    "buildPromptIfNeeded": "brief description only — full spec comes in Response 2"
  },
  "quickCheckQuestions": [
    {
      "question": "tests one thing from the guided interaction just completed",
      "correctAnswer": "full text of correct option",
      "correctExplanation": "1–2 sentences to the student: WHY this is right, scientifically precise",
      "wrongAnswer1": "plausible wrong option grounded in the misconception above",
      "wrongAnswer1Explanation": "what the student who picks this is thinking, and the precise correction",
      "wrongAnswer2": "second plausible wrong option, grounded in a different aspect of the misconception",
      "wrongAnswer2Explanation": "what the student who picks this is thinking, and the precise correction",
      "coachHint": "one sentence that guides thinking without giving the answer"
    },
    {
      "question": "second recall question — tests a different part of the same interaction",
      "correctAnswer": "",
      "correctExplanation": "",
      "wrongAnswer1": "",
      "wrongAnswer1Explanation": "",
      "wrongAnswer2": "",
      "wrongAnswer2Explanation": "",
      "coachHint": ""
    }
  ],
  "challengeQuestions": [
    {
      "question": "unfamiliar scenario — student must reason, not recall",
      "correctAnswer": "",
      "correctExplanation": "2–3 plain sentences: how to reason through this",
      "wrongAnswers": ["wrong 1", "wrong 2"],
      "wrongAnswerExplanations": ["why wrong 1", "why wrong 2"]
    }
  ]
}

Rules:
- No [VISUAL] tags anywhere — the interaction provides the visual experience
- Practice: 2–3 questions maximum, embedded in the lesson flow
- Challenge: maximum 3 questions, plain text, application not recall
- Every coach card: 1–3 sentences, plain language
- Every explanation written directly to the student — plain, brief, specific
- interactionBuildPrompt is NOT in this JSON — it comes in Response 2
- Output JSON only for Response 1. Stop after the JSON.

---

After the JSON has been returned and confirmed, produce Response 2:

RESPONSE 2 — INTERACTION BUILD PROMPT

A complete, standalone specification for building the interaction component.
Not JSON. Plain text for a developer or coding AI to build from directly.

Cover:
- Educational objective: what concept this teaches and how the interaction reveals it
- Student experience: what the student sees, does, and discovers — start to finish
- Complete interaction flow: every step — student action, system response, concept revealed, coach line
- All interactive objects: name, appearance, behaviour
- Visual layout: what occupies each part of the screen
- Animations: what animates, how, speed, trigger
- User actions: exactly what is interactive and how it responds
- Feedback behaviour: system response for correct action, incorrect action, in-progress
- Success and completion conditions
- SVG assets or illustrations required
- Implementation notes: mobile-first (360px), touch targets (44×44px min), offline-capable
- SVG assets or illustrations required: every image, icon, or illustration
  — name, description, approximate size
- Implementation notes: responsive behaviour (360px mobile → desktop),
  touch targets (minimum 44×44px), offline capability, performance notes,
  accessibility requirements`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const baseInp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "7px 10px", color: "var(--text)",
  fontSize: "0.82rem", fontFamily: "inherit", outline: "none",
};
const baseTa: React.CSSProperties = { ...baseInp, resize: "vertical" as const, minHeight: 56 };

const FL = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>
    {children}
  </div>
);

// ── Tab type ──────────────────────────────────────────────────────────────────

type ContentTab = "gl" | "pq" | "cq";

// ── GL Editor ─────────────────────────────────────────────────────────────────

function GLEditor({ concept, onChange, onInteractionChange, colour, readOnly, subject }: {
  concept: Concept;
  onChange: (c: Concept) => void;
  onInteractionChange?: (c: Concept) => void;
  colour: string;
  readOnly: boolean;
  subject: string;
}) {
  const gl = concept.guidedLearningMission;

  const setGL = (patch: Partial<GuidedLearningMission>) => {
    if (!gl) return;
    onChange({ ...concept, guidedLearningMission: { ...gl, ...patch } });
  };

  if (!gl) return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-4)", fontSize: "0.82rem" }}>
      No Guided Learning content yet — paste Claude&apos;s JSON to generate it.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <FL>Mission name</FL>
        <input style={baseInp} value={gl.missionName} readOnly={readOnly}
          onChange={e => setGL({ missionName: e.target.value })} />
      </div>

      <div>
        <FL>Coach briefing cards</FL>
        {(gl.coachBriefing ?? []).map((card, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: "0.6rem", color: "var(--text-4)", marginBottom: 3 }}>Card {i + 1}</div>
            <textarea style={{ ...baseTa, minHeight: 44 }} value={card} readOnly={readOnly} rows={2}
              onChange={e => {
                const cards = [...gl.coachBriefing]; cards[i] = e.target.value;
                setGL({ coachBriefing: cards });
              }} />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <FL>What student does</FL>
          <textarea style={baseTa} value={gl.interaction?.whatStudentDoes ?? ""} readOnly={readOnly} rows={2}
            onChange={e => setGL({ interaction: { ...gl.interaction, whatStudentDoes: e.target.value } })} />
        </div>
        <div>
          <FL>What system shows</FL>
          <textarea style={baseTa} value={gl.interaction?.whatSystemShows ?? ""} readOnly={readOnly} rows={2}
            onChange={e => setGL({ interaction: { ...gl.interaction, whatSystemShows: e.target.value } })} />
        </div>
      </div>

      <div>
        <FL>Key moment</FL>
        <textarea style={baseTa} value={gl.interaction?.keyMoment ?? ""} readOnly={readOnly} rows={2}
          onChange={e => setGL({ interaction: { ...gl.interaction, keyMoment: e.target.value } })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <FL>Coach at key moment</FL>
          <textarea style={baseTa} value={gl.coachLines?.atKeyMoment ?? ""} readOnly={readOnly} rows={2}
            onChange={e => setGL({ coachLines: { ...gl.coachLines, atKeyMoment: e.target.value } })} />
        </div>
        <div>
          <FL>Coach on success</FL>
          <textarea style={baseTa} value={gl.coachLines?.onSuccess ?? ""} readOnly={readOnly} rows={2}
            onChange={e => setGL({ coachLines: { ...gl.coachLines, onSuccess: e.target.value } })} />
        </div>
      </div>

      <div>
        <FL>Learning objectives</FL>
        {(gl.objectives ?? []).map((obj, i) => (
          <input key={i} style={{ ...baseInp, marginBottom: 5 }} value={obj} readOnly={readOnly}
            onChange={e => {
              const objs = [...gl.objectives]; objs[i] = e.target.value;
              setGL({ objectives: objs });
            }} />
        ))}
      </div>

      {/* Interaction component */}
      <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Interaction component
        </div>
        <InteractionSelector
          value={concept.interactionRef ?? null}
          onChange={(ref: import("./InteractionSelector").InteractionRef | null) => {
            const updated = { ...concept, interactionRef: ref };
            onChange(updated);
            onInteractionChange?.(updated);
          }}
          subject={subject}
          colour={colour}
          readOnly={false}
        />
      </div>
    </div>
  );
}

// ── PQ Editor ─────────────────────────────────────────────────────────────────

function PQEditor({ concept, onChange, readOnly }: {
  concept: Concept; onChange: (c: Concept) => void; readOnly: boolean;
}) {
  const pqs = concept.quickCheckQuestions ?? [];
  const setPQ = (i: number, patch: Partial<QuickCheckQuestion>) => {
    const qs = [...pqs]; qs[i] = { ...qs[i], ...patch };
    onChange({ ...concept, quickCheckQuestions: qs });
  };

  if (!pqs.length) return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-4)", fontSize: "0.82rem" }}>
      No Practice questions yet — paste Claude&apos;s JSON to generate them.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pqs.map((q, i) => (
        <div key={i} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#7c3aed", marginBottom: 10 }}>
            Question {i + 1}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div><FL>Question</FL>
              <textarea style={{ ...baseTa, minHeight: 44 }} value={q.question} readOnly={readOnly} rows={2}
                onChange={e => setPQ(i, { question: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><FL>✓ Correct</FL>
                <input style={{ ...baseInp, borderColor: "rgba(5,150,105,0.4)" }} value={q.correctAnswer} readOnly={readOnly}
                  onChange={e => setPQ(i, { correctAnswer: e.target.value })} /></div>
              <div><FL>✗ Wrong 1</FL>
                <input style={{ ...baseInp, borderColor: "rgba(239,68,68,0.3)" }} value={q.wrongAnswer1} readOnly={readOnly}
                  onChange={e => setPQ(i, { wrongAnswer1: e.target.value })} /></div>
              <div><FL>✗ Wrong 2</FL>
                <input style={{ ...baseInp, borderColor: "rgba(239,68,68,0.3)" }} value={q.wrongAnswer2} readOnly={readOnly}
                  onChange={e => setPQ(i, { wrongAnswer2: e.target.value })} /></div>
            </div>
            <div><FL>Coach hint</FL>
              <textarea style={{ ...baseTa, minHeight: 40 }} value={q.coachHint} readOnly={readOnly} rows={2}
                onChange={e => setPQ(i, { coachHint: e.target.value })} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CQ Editor ─────────────────────────────────────────────────────────────────

function CQEditor({ concept, onChange, readOnly }: {
  concept: Concept; onChange: (c: Concept) => void; readOnly: boolean;
}) {
  const cqs = concept.challengeQuestions ?? [];
  const setCQ = (i: number, patch: Partial<ChallengeQuestion>) => {
    const qs = [...cqs]; qs[i] = { ...qs[i], ...patch };
    onChange({ ...concept, challengeQuestions: qs });
  };

  if (!cqs.length) return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-4)", fontSize: "0.82rem" }}>
      No Challenge questions yet — paste Claude&apos;s JSON to generate them.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {cqs.map((q, i) => (
        <div key={i} style={{ background: "var(--surface-2)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#ef4444", marginBottom: 10 }}>
            Challenge {i + 1}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div><FL>Question</FL>
              <textarea style={{ ...baseTa, minHeight: 44 }} value={q.question} readOnly={readOnly} rows={2}
                onChange={e => setCQ(i, { question: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><FL>✓ Correct answer</FL>
                <input style={{ ...baseInp, borderColor: "rgba(5,150,105,0.4)" }} value={q.correctAnswer} readOnly={readOnly}
                  onChange={e => setCQ(i, { correctAnswer: e.target.value })} /></div>
              <div><FL>Reasoning path</FL>
                <textarea style={{ ...baseTa, minHeight: 40 }} value={q.reasoningPath} readOnly={readOnly} rows={2}
                  onChange={e => setCQ(i, { reasoningPath: e.target.value })} /></div>
            </div>
            <div><FL>✗ Wrong answers</FL>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(q.wrongAnswers ?? ["","",""]).map((wa, wi) => (
                  <input key={wi} style={{ ...baseInp, borderColor: "rgba(239,68,68,0.3)" }} value={wa} readOnly={readOnly}
                    onChange={e => {
                      const was = [...(q.wrongAnswers ?? ["","",""])]; was[wi] = e.target.value;
                      setCQ(i, { wrongAnswers: was });
                    }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Concept Panel ─────────────────────────────────────────────────────────────

type PanelMode = "view" | "edit" | "paste";

function ConceptPanel({ concept, index, topic, onUpdate }: {
  concept: Concept;
  index: number;
  topic: Topic;
  onUpdate: (updated: Concept) => Promise<boolean>;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [tab, setTab]               = useState<ContentTab>("gl");
  const [mode, setMode]             = useState<PanelMode>("view");
  const [draft, setDraft]           = useState<Concept>(concept);
  const [rawJson, setRawJson]       = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [copied, setCopied]         = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const meta       = SUBJECT_META[topic.subject] ?? { colour: "#64748b", coach: "the coach" };
  const statusMeta = STATUS_META[concept.status] ?? STATUS_META["not-started"];
  const missing    = getMissing(concept);
  const hasContent = !!concept.guidedLearningMission || (concept.quickCheckQuestions?.length ?? 0) > 0;
  const prompt     = buildPrompt(topic, concept, index);

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt); setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = () => {
    setParseError(null);
    const result = parseJSON(rawJson);
    if (!result.ok) { setParseError(result.error); return; }
    setDraft({ ...concept, ...(result.data as Partial<Concept>) });
    setMode("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    const toSave: Concept = {
      ...draft,
      status: draft.status === "not-started" || draft.status === "build-intent" ? "built" : draft.status,
    };
    const ok = await onUpdate(toSave);
    setSaving(false);
    if (ok) { setMode("view"); setRawJson(""); }
  };

  const handleAdvance = async () => {
    const next = statusMeta.next;
    if (!next) return;
    await onUpdate({ ...concept, status: next });
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/content-topics/${topic.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptIndex: index }),
      });
      const json = await res.json();
      if (res.ok) {
        const r = json.published?.[0];
        setPublishResult(`✓ Published — ${r?.missionCount ?? 0} missions created`);
        await onUpdate({ ...concept, status: "approved" });
      } else {
        setPublishResult(`✗ ${json.error}`);
      }
    } catch (e) {
      setPublishResult(`✗ ${(e as Error).message}`);
    }
    setPublishing(false);
  };

  const startEdit = () => { setDraft({ ...concept }); setMode("edit"); };

  // Which concept to show in preview — draft in edit mode, saved in view mode
  const previewConcept = mode === "edit" ? draft : concept;

  // Tab config
  const TABS: { key: ContentTab; label: string; done: boolean; colour: string }[] = [
    { key: "gl", label: "Guided Learning", done: !!concept.guidedLearningMission, colour: meta.colour },
    { key: "pq", label: `Practice (${concept.quickCheckQuestions?.length ?? 0})`, done: (concept.quickCheckQuestions?.length ?? 0) > 0, colour: "#7c3aed" },
    { key: "cq", label: `Challenge (${concept.challengeQuestions?.length ?? 0})`, done: (concept.challengeQuestions?.length ?? 0) > 0, colour: "#ef4444" },
  ];

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div className={styles.conceptRow} data-status={concept.status}>

      {/* ── Row header ── */}
      <div className={styles.conceptHeader} onClick={() => setExpanded(e => !e)}>
        <div className={styles.conceptNum}>{index + 1}</div>
        <div className={styles.conceptInfo}>
          <div className={styles.conceptName}>{concept.name}</div>
          <div className={styles.conceptStage}>{concept.stage}</div>
        </div>

        <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
          {TABS.map(t => (
            <span key={t.key} style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: t.done ? `${t.colour}12` : "var(--surface-2)",
              border: `1px solid ${t.done ? `${t.colour}35` : "var(--border)"}`,
              color: t.done ? t.colour : "var(--text-4)",
            }}>{t.done ? "✓" : "○"} {t.key.toUpperCase()}</span>
          ))}
          {missing.length > 0 && missing.map(m => (
            <span key={m} style={{
              fontSize: "0.62rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
              background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.25)", color: "#b45309",
            }}>Missing: {m}</span>
          ))}
        </div>

        <div className={styles.conceptRight}>
          <div className={styles.statusBadge} style={{
            color: statusMeta.colour, borderColor: `${statusMeta.colour}30`, background: `${statusMeta.colour}10`,
          }}>{statusMeta.label}</div>
          <div className={styles.expandArrow}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className={styles.conceptExpanded}>

          {/* Build intent */}
          {concept.buildIntent && (
            <div className={styles.intentBlock}>
              <div className={styles.blockTitle}>Build intent</div>
              <div className={styles.intentGrid}>
                {([
                  ["What student does", concept.buildIntent.whatStudentDoes],
                  ["What system shows", concept.buildIntent.whatSystemShows],
                  ["Coach opening",     concept.buildIntent.coachOpeningLine],
                  ["Success looks like",concept.buildIntent.successLooks],
                ] as [string, string][]).map(([lbl, txt]) => (
                  <div key={lbl} className={styles.intentItem}>
                    <div className={styles.intentLabel}>{lbl}</div>
                    <div className={styles.intentText}>{txt}</div>
                  </div>
                ))}
              </div>
              {concept.misconception && (
                <div className={styles.misconceptionTag}>⚠ Misconception: {concept.misconception}</div>
              )}
            </div>
          )}

          {/* ── Content tabs ── */}
          <div style={{
            display: "flex",
            background: "var(--surface-2)", borderRadius: "8px 8px 0 0",
            border: "1px solid var(--border)", borderBottom: "none",
            overflow: "hidden",
          }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "10px 8px", border: "none", borderRight: "1px solid var(--border)",
                background: tab === t.key ? `${t.colour}12` : "transparent",
                color: tab === t.key ? t.colour : "var(--text-3)",
                fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                borderBottom: tab === t.key ? `2px solid ${t.colour}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                {t.label}
                {!t.done && <span style={{ marginLeft: 4, opacity: 0.5, fontWeight: 400 }}>·</span>}
              </button>
            ))}
          </div>

          {/* ── Tab content + preview side by side ── */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, alignItems: "start",
            border: "1px solid var(--border)", borderRadius: "0 0 10px 10px", overflow: "hidden",
          }}>

            {/* Left: editor / paste */}
            <div style={{ borderRight: "1px solid var(--border)", padding: 16, minHeight: 200 }}>

              {/* Paste mode */}
              {mode === "paste" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: meta.colour, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Paste Claude&apos;s response
                    </div>
                    <button onClick={() => { setMode("view"); setRawJson(""); setParseError(null); }} style={{
                      background: "none", border: "none", color: "var(--text-4)", fontSize: "0.72rem", cursor: "pointer",
                    }}>← Back</button>
                  </div>
                  <button onClick={copyPrompt} style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
                    background: "transparent", color: "var(--text-3)", fontSize: "0.72rem", cursor: "pointer",
                  }}>{copied ? "✓ Prompt copied" : "Copy prompt first →"}</button>
                  <textarea className={styles.jsonArea} value={rawJson} rows={10}
                    onChange={e => { setRawJson(e.target.value); setParseError(null); }}
                    placeholder={"Paste Claude's complete JSON response here.\nIncludes GL mission, interactionRef, practice questions, challenge questions."} />
                  {parseError && (
                    <div className={styles.error}>
                      <strong>Could not parse:</strong> {parseError}
                      <div style={{ marginTop: 4, fontSize: "0.7rem", opacity: 0.7 }}>
                        Copy only from the first {"{"} to the last {"}"} and try again.
                      </div>
                    </div>
                  )}
                  <button onClick={handlePaste} disabled={!rawJson.trim()} style={{
                    padding: "10px", borderRadius: 7, border: "none",
                    background: rawJson.trim() ? meta.colour : "var(--border)",
                    color: rawJson.trim() ? "#fff" : "var(--text-4)",
                    fontSize: "0.82rem", fontWeight: 700,
                    cursor: rawJson.trim() ? "pointer" : "not-allowed", width: "100%",
                  }}>Preview content →</button>
                </div>
              )}

              {/* View / edit mode */}
              {mode !== "paste" && (
                <>
                  {/* Action bar */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                    {mode === "view" && hasContent && (
                      <>
                        <button onClick={startEdit} style={{
                          padding: "6px 14px", borderRadius: 6, border: `1px solid ${meta.colour}`,
                          background: "transparent", color: meta.colour, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                        }}>Edit</button>
                        <button onClick={() => setMode("paste")} style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
                          background: "transparent", color: "var(--text-3)", fontSize: "0.72rem", cursor: "pointer",
                        }}>Regenerate</button>
                      </>
                    )}
                    {mode === "view" && !hasContent && (
                      <>
                        <button onClick={copyPrompt} style={{
                          padding: "6px 14px", borderRadius: 6, border: "none",
                          background: meta.colour, color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                        }}>{copied ? "✓ Copied" : "Copy prompt"}</button>
                        <button onClick={() => setMode("paste")} style={{
                          padding: "6px 14px", borderRadius: 6, border: `1.5px dashed ${meta.colour}50`,
                          background: `${meta.colour}08`, color: meta.colour, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                        }}>Paste Claude&apos;s response →</button>
                      </>
                    )}
                    {mode === "edit" && (
                      <>
                        <button onClick={handleSave} disabled={saving} style={{
                          padding: "6px 16px", borderRadius: 6, border: "none",
                          background: meta.colour, color: "#fff", fontSize: "0.75rem", fontWeight: 700,
                          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                        }}>{saving ? "Saving…" : "Save changes"}</button>
                        <button onClick={() => { setMode("view"); setDraft(concept); }} style={{
                          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
                          background: "transparent", color: "var(--text-3)", fontSize: "0.72rem", cursor: "pointer",
                        }}>Discard</button>
                      </>
                    )}
                    {statusMeta.next && mode === "view" && (
                      <button onClick={handleAdvance} style={{
                        marginLeft: "auto", padding: "6px 12px", borderRadius: 6,
                        border: `1px solid ${statusMeta.colour}`, background: "transparent",
                        color: statusMeta.colour, fontSize: "0.72rem", cursor: "pointer",
                      }}>Mark {STATUS_META[statusMeta.next].label} →</button>
                    )}
                    {mode === "view" && hasContent && (
                      <button onClick={handlePublish} disabled={publishing} style={{
                        padding: "6px 16px", borderRadius: 6, border: "none",
                        background: publishing ? "var(--border)" : "#059669",
                        color: publishing ? "var(--text-4)" : "#fff",
                        fontSize: "0.75rem", fontWeight: 700,
                        cursor: publishing ? "not-allowed" : "pointer",
                      }}>
                        {publishing ? "Publishing…" : "🚀 Publish"}
                      </button>
                    )}
                    {publishResult && (
                      <div style={{
                        fontSize: "0.72rem", fontWeight: 600,
                        color: publishResult.startsWith("✓") ? "#34d399" : "#f87171",
                        padding: "4px 10px", borderRadius: 6,
                        background: publishResult.startsWith("✓") ? "rgba(5,150,105,0.1)" : "rgba(239,68,68,0.1)",
                      }}>{publishResult}</div>
                    )}
                  </div>

                  {/* Tab content */}
                  {tab === "gl" && (
                    <GLEditor
                      concept={mode === "edit" ? draft : concept}
                      onChange={setDraft}
                      onInteractionChange={async (updated) => {
                        // Save immediately — no need to enter Edit mode for interaction selection
                        setDraft(updated);
                        await onUpdate(updated);
                      }}
                      colour={meta.colour}
                      readOnly={mode === "view"}
                      subject={topic.subject}
                    />
                  )}
                  {tab === "pq" && (
                    <PQEditor
                      concept={mode === "edit" ? draft : concept}
                      onChange={setDraft}
                      readOnly={mode === "view"}
                    />
                  )}
                  {tab === "cq" && (
                    <CQEditor
                      concept={mode === "edit" ? draft : concept}
                      onChange={setDraft}
                      readOnly={mode === "view"}
                    />
                  )}
                </>
              )}
            </div>

            {/* Right: live preview — synced to active tab */}
            <div style={{ padding: 16 }}>
              <ContentPreview
                concept={previewConcept}
                subject={topic.subject}
                coach={meta.coach}
                colour={activeTab.colour}
                activeTab={tab}
                onTabChange={setTab}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type FilterType = "all" | "missing" | "built" | "approved";

export default function TopicDetailClient({ topic: initialTopic }: { topic: Topic }) {
  const router = useRouter();
  const [topic, setTopic]   = useState<Topic>(initialTopic);
  const [filter, setFilter] = useState<FilterType>("all");

  const patchConcept = async (index: number, updated: Concept): Promise<boolean> => {
    const newConcepts = topic.concepts.map((c, i) => i === index ? updated : c);
    const res = await fetch(`/api/content-topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concepts: newConcepts }),
    });
    const json = await res.json();
    if (res.ok) { setTopic(json.topic); router.refresh(); return true; }
    return false;
  };

  const meta         = SUBJECT_META[topic.subject] ?? { colour: "#64748b" };
  const builtCount   = topic.concepts.filter(c => c.status === "built" || c.status === "approved").length;
  const missingCount = topic.concepts.filter(c => getMissing(c).length > 0).length;
  const totalPct     = topic.concepts.length ? Math.round((builtCount / topic.concepts.length) * 100) : 0;

  const FILTERS: { key: FilterType; label: string; count: number }[] = [
    { key: "all",      label: "All",      count: topic.concepts.length },
    { key: "missing",  label: "Missing",  count: missingCount },
    { key: "built",    label: "Built",    count: topic.concepts.filter(c => c.status === "built").length },
    { key: "approved", label: "Approved", count: topic.concepts.filter(c => c.status === "approved").length },
  ];

  const filtered = topic.concepts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (filter === "missing")  return getMissing(c).length > 0;
      if (filter === "built")    return c.status === "built";
      if (filter === "approved") return c.status === "approved";
      return true;
    });

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/admin/content" className={styles.breadcrumbLink}>Content</a>
        <span className={styles.sep}>/</span>
        <span>{topic.name}</span>
      </div>

      <div className={styles.topicHeader} style={{ "--accent": meta.colour } as React.CSSProperties}>
        <div className={styles.topicAccent} style={{ background: meta.colour }} />
        <div className={styles.topicHeaderBody}>
          <div className={styles.topicSubject} style={{ color: meta.colour }}>
            {topic.subject.charAt(0).toUpperCase() + topic.subject.slice(1)} · {topic.level}
          </div>
          <h1 className={styles.topicName}>{topic.name}</h1>
          <div className={styles.topicMeta}>
            {topic.curricula?.join(", ")} · {topic.concepts.length} concepts · {builtCount} built
            {missingCount > 0 && <span style={{ color: "#b45309", marginLeft: 8 }}>· {missingCount} incomplete</span>}
          </div>
          <div className={styles.topicProgress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${totalPct}%`, background: meta.colour }} />
            </div>
            <span className={styles.progressLabel}>{totalPct}%</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 20, cursor: "pointer",
            fontSize: "0.78rem", fontWeight: 600,
            border: filter === f.key ? `1.5px solid ${meta.colour}` : "1.5px solid var(--border)",
            background: filter === f.key ? `${meta.colour}14` : "transparent",
            color: filter === f.key ? meta.colour : "var(--text-3)",
          }}>
            {f.label} <span style={{ marginLeft: 4, fontSize: "0.68rem", fontWeight: 800, opacity: 0.7 }}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className={styles.conceptList}>
        {filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: "0.82rem" }}>
            No concepts match this filter.
          </div>
        )}
        {filtered.map(({ c, i }) => (
          <ConceptPanel key={i} concept={c} index={i} topic={topic}
            onUpdate={updated => patchConcept(i, updated)} />
        ))}
      </div>

      {topic.misconceptions && topic.misconceptions.length > 0 && (
        <div className={styles.misconceptionsSection}>
          <div className={styles.sectionTitle}>Misconceptions to address</div>
          <div className={styles.misconceptionList}>
            {topic.misconceptions.map((m, i) => (
              <div key={i} className={styles.misconceptionCard}>
                <div className={styles.misconceptionBelief}>&quot;{m.belief}&quot;</div>
                <div className={styles.misconceptionCorrection}>{m.correction}</div>
                <div className={styles.misconceptionStage}>{m.stage}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}