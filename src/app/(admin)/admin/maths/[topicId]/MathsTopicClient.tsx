"use client";
// FILE: src/app/(admin)/admin/maths/[topicId]/MathsTopicClient.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../content/[topicId]/topic.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Concept {
  name: string;
  stage: string;
  status: "not-started" | "build-intent" | "in-progress" | "built" | "approved";
  simplestTrueStatement?: string;
  misconception?: string;
  realWorldAnchor?: string;
  typicalQuestion?: string;
  operationsNeeded?: string[];
  difficultyNotes?: string;
  // Generated content stored here after paste-back
  guidedQuestions?: unknown[];
  practiceQuestions?: unknown[];
  challengeQuestions?: unknown[];
}

interface Topic {
  id: string;
  name: string;
  level: string;
  game_slug?: string;
  topic_id?: string;
  curricula: string[];
  concepts: Concept[];
  misconceptions?: Array<{ belief: string; correction: string; stage: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<Concept["status"], { label: string; colour: string; next: Concept["status"] | null }> = {
  "not-started":  { label: "Not started",    colour: "#3a4455", next: "build-intent" },
  "build-intent": { label: "Intent written", colour: "#b45309", next: "in-progress"  },
  "in-progress":  { label: "In progress",    colour: "#7c3aed", next: "built"        },
  "built":        { label: "Built",          colour: "#0284c7", next: "approved"     },
  "approved":     { label: "Approved",       colour: "#059669", next: null           },
};

const ACCENT = "#059669";

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildStepwisePrompt(topic: Topic, concept: Concept, idx: number): string {
  const topicId = topic.topic_id || topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const subtopicId = concept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const baseSeq = (idx + 1) * 10;

  return `You are a senior mathematics curriculum designer for EXL Learning World.

EXL teaches maths via the Stepwise Solver Engine.
Students pick the correct operation at each step, then fill in the arithmetic.
Ms. Chidera coaches them through the steps in short, algebraic dialogue beats.

TOPIC: ${topic.name}
LEVEL: ${topic.level}
GAME SLUG: ${topic.game_slug || topicId}
TOPIC ID: ${topicId}
CONCEPT ${idx + 1}: ${concept.name}
SUBTOPIC ID: ${subtopicId}

CONCEPT STATEMENT: ${concept.simplestTrueStatement ?? ""}
REAL-WORLD ANCHOR: ${concept.realWorldAnchor ?? "(none)"}
MISCONCEPTION TO ADDRESS: ${concept.misconception ?? "(none)"}
TYPICAL QUESTION: ${concept.typicalQuestion ?? "(none)"}
OPERATIONS NEEDED: ${(concept.operationsNeeded ?? []).join(", ") || "(see concept)"}
DIFFICULTY NOTES: ${concept.difficultyNotes ?? ""}

---

YOUR TASK:
Generate a complete set of Stepwise Solver questions for this concept.
Cover all four modes: Guided, Practice, Challenge, Mastery.
Return ONLY valid JSON. No preamble. No markdown fences.

---

{
  "concept": "${concept.name}",
  "topicId": "${topicId}",
  "subtopicId": "${subtopicId}",

  "guidedQuestions": [
    {
      "missionKey": "gl-${String(idx + 1).padStart(3, "0")}-a",
      "title": "short engaging title — curious, not academic",
      "difficulty": "EASY",
      "sequenceIndex": ${baseSeq + 1},
      "xpReward": 20,
      "topicId": "${topicId}",
      "subtopicId": "${subtopicId}",
      "payload": {
        "formula": "starting formula or equation",
        "goal": "e.g. Make x the subject",
        "topic": "${concept.name}",
        "finalAnswer": "e.g. x = y + 3",
        "steps": [
          {
            "label": "Specific action — e.g. Add 3 to both sides",
            "eq": "result of this step",
            "operation": "add",
            "isFinal": false,
            "workingLines": [
              {"text": "  [starting state]"},
              {"text": "  [operation applied to both sides]"},
              {"text": "  ─────────────────"},
              {"text": "  [result] = ?",
               "blank": {"answer": "[correct]", "options": ["[correct]", "[wrong1]", "[wrong2]"]}},
              {"text": "  [final result] ✓"}
            ]
          }
        ]
      }
    }
  ],

  "practiceQuestions": [
    {
      "missionKey": "pr-${String(idx + 1).padStart(3, "0")}-a",
      "title": "short title",
      "difficulty": "MEDIUM",
      "sequenceIndex": ${baseSeq + 1},
      "xpReward": 40,
      "topicId": "${topicId}",
      "subtopicId": "${subtopicId}",
      "payload": {
        "formula": "different values from Guided",
        "goal": "e.g. Make x the subject",
        "topic": "${concept.name}",
        "finalAnswer": "result",
        "steps": [ ]
      }
    }
  ],

  "challengeQuestions": [
    {
      "missionKey": "ch-${String(idx + 1).padStart(3, "0")}-a",
      "title": "short title",
      "difficulty": "HARD",
      "sequenceIndex": ${baseSeq + 1},
      "xpReward": 75,
      "topicId": "${topicId}",
      "subtopicId": "${subtopicId}",
      "payload": {
        "formula": "exam-style — harder values or unfamiliar form",
        "goal": "e.g. Make x the subject",
        "topic": "${concept.name}",
        "finalAnswer": "result",
        "answerChoices": [
          {"label": "correct answer", "correct": true},
          {"label": "wrong — wrong sign", "correct": false},
          {"label": "wrong — wrong operation order", "correct": false}
        ]
      }
    }
  ],

  "masteryQuestions": [
    {
      "missionKey": "ms-${String(idx + 1).padStart(3, "0")}-a",
      "title": "short title",
      "difficulty": "HARD",
      "sequenceIndex": ${baseSeq + 51},
      "xpReward": 75,
      "topicId": "${topicId}",
      "subtopicId": "${subtopicId}",
      "payload": {
        "formula": "exam-level — may combine this concept with an earlier one",
        "goal": "exam-style goal",
        "topic": "${concept.name}",
        "finalAnswer": "result",
        "answerChoices": [
          {"label": "correct", "correct": true},
          {"label": "wrong", "correct": false},
          {"label": "wrong", "correct": false}
        ]
      }
    }
  ]
}

---

CONTENT RULES — READ EVERY RULE:

GUIDED (EASY) — write 3 questions minimum:
- Simplest possible examples. Single-digit numbers where possible.
- Every step MUST have workingLines.
- workingLines structure (always this order):
    Line 1: starting state
    Line 2: operation applied to both sides
    Line 3: ─────────────────
    Line 4: result with blank — answer hidden behind ?
    Line 5: final confirmed result with ✓
- ⚠️ THE ANSWER MUST NEVER APPEAR ON THE SAME LINE AS THE ?
  The answer is on the NEXT line after the blank.
- Exactly 3 options per blank.
  All 3 must be things a student who made a specific error would produce.
  No random or obviously-wrong options.
- label must be the full specific action: "Add 3 to both sides" not "Add"
- operation must be exactly one of:
  add | subtract | multiply | divide | sqrt | square | rewrite | substitute | solve
- isFinal: true on the last step only

PRACTICE (MEDIUM) — write 4 questions minimum:
- Different values from Guided. Range from easy to harder.
- Same format as Guided — include steps and workingLines.
- isFinal: true only on the last step.

CHALLENGE (HARD) — write 3 questions minimum:
- No steps array. Use answerChoices only.
- Exactly 3 choices. Exactly 1 "correct": true.
- Wrong choices must exploit the misconception from the concept statement.
- Use: wrong sign, wrong operation order, moved wrong term, incomplete step.

MASTERY (HARD) — write 2 questions minimum:
- Exam-level. May combine this concept with a related one.
- Same MCQ format as Challenge. No steps.
- Phrased exactly as it would appear in WAEC or IGCSE.

MS. CHIDERA'S REGISTER — critical: she speaks INSIDE the action zone, directly above the choices.
Her text must do two things in one or two short sentences:
  1. Name what is happening algebraically (the explanation)
  2. Set up the choice the student is about to make (the question)

✅ "x has −3 attached. Which operation removes it?"
✅ "The 2 is multiplying x. What operation isolates x?"
✅ "Both sides need the same operation. What cancels +y here?"
❌ "Something has been subtracted from our target." (too vague, no setup)
❌ "Add 3 to both sides — that cancels it." (gives away the answer)
❌ "Let's look at x first." (explains nothing, sets up nothing)

The student reads her line, then immediately sees the choices below.
She explains WHY the operation is needed, not WHAT the operation is.
Keep it under 15 words. One or two sentences maximum.

FRACTIONS: Write as a / b — engine renders as proper fraction.
Do not write LaTeX. Do not write \\frac{}.

OUTPUT: JSON only. Nothing else. The JSON must be valid and complete.`;
}

// ── JSON parser ────────────────────────────────────────────────────────────────

function parseJSON(raw: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  let s = raw.trim()
    .replace(/^```json?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return { ok: false, error: "No JSON object found." };
  s = s.slice(start, end + 1)
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([\]}])/g, "$1");
  try { return { ok: true, data: JSON.parse(s) }; }
  catch (e) { return { ok: false, error: `Parse error: ${(e as Error).message}` }; }
}

// ── Concept row ────────────────────────────────────────────────────────────────

function ConceptRow({
  concept, idx, topic, onSave,
}: {
  concept: Concept;
  idx: number;
  topic: Topic;
  onSave: (updated: Concept) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [copied, setCopied]     = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const prompt = buildStepwisePrompt(topic, concept, idx);
  const sm = STATUS_META[concept.status];

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const guidedCount    = concept.guidedQuestions?.length ?? 0;
  const practiceCount  = concept.practiceQuestions?.length ?? 0;
  const challengeCount = concept.challengeQuestions?.length ?? 0;

  const handleImport = async () => {
    if (!jsonInput.trim()) { setJsonError("Paste Claude's JSON first."); return; }
    setJsonError(null);
    const result = parseJSON(jsonInput);
    if (!result.ok) { setJsonError(result.error); return; }
    const d = result.data;

    const updated: Concept = {
      ...concept,
      status: "built",
      guidedQuestions:    (d.guidedQuestions    as unknown[]) ?? [],
      practiceQuestions:  (d.practiceQuestions  as unknown[]) ?? [],
      challengeQuestions: (d.challengeQuestions as unknown[]) ?? [],
    };

    setSaving(true);
    try {
      onSave(updated);
      setJsonInput("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${sm.colour}`,
      borderRadius: 8,
      marginBottom: 8,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", cursor: "pointer",
          background: "var(--surface-1)",
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-4)", minWidth: 18 }}>
          {idx + 1}
        </span>
        <span style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600, color: "var(--text)" }}>
          {concept.name}
        </span>

        {/* Question counts */}
        {(guidedCount + practiceCount + challengeCount) > 0 && (
          <span style={{ fontSize: "0.7rem", color: "var(--text-4)", display: "flex", gap: 6 }}>
            {guidedCount > 0 && <span title="Guided" style={{ color: "#059669" }}>G:{guidedCount}</span>}
            {practiceCount > 0 && <span title="Practice" style={{ color: "#7c3aed" }}>P:{practiceCount}</span>}
            {challengeCount > 0 && <span title="Challenge" style={{ color: "#b45309" }}>C:{challengeCount}</span>}
          </span>
        )}

        <span style={{
          fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
          borderRadius: 20, background: sm.colour + "22", color: sm.colour,
        }}>
          {sm.label}
        </span>
        <span style={{ color: "var(--text-4)", fontSize: "0.8rem" }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: "14px 16px", background: "var(--surface-0)", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Concept metadata */}
          {concept.simplestTrueStatement && (
            <div style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: "var(--text-3)" }}>Statement: </span>
              {concept.simplestTrueStatement}
            </div>
          )}
          {concept.typicalQuestion && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
              e.g. {concept.typicalQuestion}
            </div>
          )}
          {concept.misconception && (
            <div style={{
              fontSize: "0.78rem", color: "#f5a623",
              background: "rgba(245,166,35,0.07)", borderRadius: 6, padding: "6px 10px",
              borderLeft: "3px solid #f5a623",
            }}>
              ⚠️ Misconception: {concept.misconception}
            </div>
          )}

          {/* Existing questions summary */}
          {(guidedCount + practiceCount + challengeCount) > 0 && (
            <div style={{
              display: "flex", gap: 8, fontSize: "0.75rem",
              background: "var(--surface-1)", borderRadius: 6, padding: "8px 12px",
            }}>
              <span style={{ color: "#059669" }}>✓ {guidedCount} Guided</span>
              <span style={{ color: "#7c3aed" }}>✓ {practiceCount} Practice</span>
              <span style={{ color: "#b45309" }}>✓ {challengeCount} Challenge</span>
            </div>
          )}

          {/* Step 1: copy prompt */}
          <div style={{
            background: "var(--surface-1)", borderRadius: 8, padding: 12,
            border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Step 1
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>
                  Copy prompt → paste into Claude
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-4)", marginTop: 2 }}>
                  Generates Guided, Practice, Challenge, and Mastery questions for this concept.
                </div>
              </div>
              <button
                onClick={copyPrompt}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                  border: `1px solid ${copied ? ACCENT : "var(--border)"}`,
                  background: copied ? ACCENT + "18" : "var(--surface-2)",
                  color: copied ? ACCENT : "var(--text-2)",
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {copied ? "✓ Copied" : "Copy prompt"}
              </button>
            </div>
            <pre style={{
              fontSize: "0.68rem", color: "var(--text-4)", background: "var(--surface-2)",
              borderRadius: 6, padding: "8px 10px", overflowX: "auto",
              maxHeight: 80, margin: 0,
            }}>
              {prompt.slice(0, 250)}…
            </pre>
          </div>

          {/* Step 2: paste JSON back */}
          <div style={{
            background: "var(--surface-1)", borderRadius: 8, padding: 12,
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Step 2
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              Paste Claude's JSON here
            </div>
            <textarea
              value={jsonInput}
              onChange={e => { setJsonInput(e.target.value); setJsonError(null); }}
              placeholder="Paste Claude's complete JSON response…"
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 100,
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "8px 10px", color: "var(--text)",
                fontSize: "0.75rem", fontFamily: "monospace", resize: "vertical",
              }}
            />
            {jsonError && (
              <div style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 6, padding: "6px 10px", background: "rgba(248,113,113,0.08)", borderRadius: 6 }}>
                {jsonError}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={saving || !jsonInput.trim()}
              style={{
                marginTop: 8, padding: "8px 16px", borderRadius: 6,
                border: "none", background: ACCENT, color: "#fff",
                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                opacity: (saving || !jsonInput.trim()) ? 0.4 : 1,
              }}
            >
              {saving ? "Importing…" : "Import questions →"}
            </button>
          </div>

          {/* Upload reminder */}
          {guidedCount > 0 && (
            <div style={{
              fontSize: "0.72rem", color: "var(--text-4)",
              background: "var(--surface-1)", borderRadius: 6,
              padding: "8px 12px", borderLeft: "3px solid var(--border)",
            }}>
              ✓ Questions imported. Upload to the game via{" "}
              <a href="/admin/games/upload" style={{ color: ACCENT }}>Admin → Upload JSON</a>.
              Use the game slug: <code style={{ fontFamily: "monospace" }}>{topic.game_slug || topic.topic_id}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function MathsTopicClient({ topic: initialTopic }: { topic: Topic }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [saving, setSaving] = useState(false);

  const updateConcept = async (idx: number, updated: Concept) => {
    const newConcepts = topic.concepts.map((c, i) => i === idx ? updated : c);
    const newTopic = { ...topic, concepts: newConcepts };
    setTopic(newTopic);

    setSaving(true);
    try {
      await fetch(`/api/maths-topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concepts: newConcepts }),
      });
    } finally {
      setSaving(false);
    }
  };

  const builtCount = topic.concepts.filter(c => c.status === "built" || c.status === "approved").length;
  const pct = topic.concepts.length
    ? Math.round(builtCount / topic.concepts.length * 100)
    : 0;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: "0.75rem", color: "var(--text-4)", marginBottom: 20, display: "flex", gap: 8 }}>
        <a href="/admin/maths" style={{ color: ACCENT, textDecoration: "none" }}>📐 Maths</a>
        <span>/</span>
        <span>{topic.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
            {topic.name}
          </h1>
          <div style={{ fontSize: "0.8rem", color: "var(--text-4)", marginTop: 4, display: "flex", gap: 12 }}>
            <span>{topic.level}</span>
            {topic.game_slug && (
              <span style={{ fontFamily: "monospace", color: ACCENT }}>{topic.game_slug}</span>
            )}
            <span>{topic.concepts.length} concepts</span>
            <span style={{ color: builtCount > 0 ? "#059669" : "var(--text-4)" }}>{builtCount} built</span>
            {saving && <span style={{ color: "#f5a623" }}>Saving…</span>}
          </div>

          {/* Progress bar */}
          {topic.concepts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div style={{ width: 180, height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-4)" }}>{pct}%</span>
            </div>
          )}
        </div>

        <a href="/admin/games/upload" style={{
          padding: "8px 16px", borderRadius: 8, background: ACCENT, color: "#fff",
          fontSize: "0.82rem", fontWeight: 700, textDecoration: "none",
        }}>
          Upload JSON →
        </a>
      </div>

      {/* Engine info strip */}
      <div style={{
        background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)",
        borderRadius: 8, padding: "10px 14px", marginBottom: 24,
        fontSize: "0.78rem", color: "var(--text-3)", display: "flex", gap: 16,
      }}>
        <span>⚙️ Stepwise Solver Engine</span>
        <span>👩🏾‍🏫 Ms. Chidera</span>
        <span>📐 Generates: Guided · Practice · Challenge · Mastery</span>
      </div>

      {/* Concepts list */}
      <div>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          {topic.concepts.length} Concept{topic.concepts.length !== 1 ? "s" : ""}
        </div>
        {topic.concepts.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-4)", padding: "32px 0", textAlign: "center" }}>
            No concepts yet — regenerate the topic to populate them.
          </div>
        ) : (
          topic.concepts.map((concept, idx) => (
            <ConceptRow
              key={idx}
              concept={concept}
              idx={idx}
              topic={topic}
              onSave={(updated) => updateConcept(idx, updated)}
            />
          ))
        )}
      </div>

      {/* Misconceptions */}
      {(topic.misconceptions ?? []).length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            {topic.misconceptions!.length} Misconception{topic.misconceptions!.length !== 1 ? "s" : ""}
          </div>
          {topic.misconceptions!.map((m, i) => (
            <div key={i} style={{
              marginBottom: 8, padding: "10px 12px",
              background: "var(--surface-1)", borderRadius: 7,
              borderLeft: "3px solid #f5a623", fontSize: "0.8rem",
            }}>
              <div style={{ fontWeight: 600, color: "#f5a623", marginBottom: 3 }}>{m.belief}</div>
              <div style={{ color: "var(--text-3)" }}>{m.correction}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}