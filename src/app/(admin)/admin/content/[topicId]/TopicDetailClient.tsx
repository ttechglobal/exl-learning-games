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

interface PracticeQuestion {
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
  practiceQuestions?: PracticeQuestion[];
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
  if (!c.practiceQuestions?.length) m.push("PQ");
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

  return `You are a senior curriculum expert and interactive learning designer for EXL Learning World.

TOPIC: ${topic.name}
SUBJECT: ${topic.subject.charAt(0).toUpperCase() + topic.subject.slice(1)}
LEVEL: ${topic.level}
CONCEPT ${idx + 1}: ${concept.name}
STAGE: ${concept.stage}
COACH: ${meta.coach}

CONCEPT: ${concept.simplestTrueStatement ?? ""}
REAL-WORLD ANCHOR: ${concept.realWorldAnchor ?? "(none)"}
BUILD INTENT:
- What student does: ${concept.buildIntent?.whatStudentDoes ?? "(not specified)"}
- What system shows: ${concept.buildIntent?.whatSystemShows ?? "(not specified)"}
- Coach opening: ${concept.buildIntent?.coachOpeningLine ?? "(not specified)"}
- Success looks like: ${concept.buildIntent?.successLooks ?? "(not specified)"}
MISCONCEPTION TO CONFRONT: ${concept.misconception ?? "(none)"}

---

AVAILABLE INTERACTION COMPONENTS (already built and ready to use):
${interactionList}

YOUR TASK FOR interactionRef:
1. Decide: does this concept NEED a visual interaction to be understood, or can coach cards alone explain it?
2. If NO interaction needed: set interactionRef to null.
3. If YES interaction needed AND an existing component fits: use it. Set componentExists: true. Provide the correct config.
4. If YES interaction needed BUT no existing component fits: set componentExists: false. Write a clear buildPrompt describing exactly what the new component should do visually and how the student interacts with it. Do NOT force an existing component where it doesn't fit.

Produce the complete content spec. Respond ONLY with valid JSON. No preamble, no markdown fences.

{
  "concept": "${concept.name}",
  "stage": "${concept.stage}",
  "guidedLearningMission": {
    "missionName": "narrative mission name — not academic",
    "coachBriefing": ["card 1: narrative hook — why is the student here", "card 2: what to observe or do", "card 3: the concept named and connected to what they just saw"],
    "interaction": {
      "whatStudentDoes": "describe the interaction",
      "whatSystemShows": "describe the feedback",
      "keyMoment": "the moment understanding clicks"
    },
    "coachLines": {
      "atKeyMoment": "what ${meta.coach} says at the key moment",
      "onSuccess": "specific completion line — not generic praise"
    },
    "objectives": ["The student can ...", "The student can ...", "The student can ..."],
    "misconceptionConfronted": "${concept.misconception ?? ""}",
    "howInteractionConfrontsIt": "what makes the wrong belief impossible to hold"
  },
  "interactionRef": {
    "component": "ComponentNameOrNull",
    "config": {},
    "componentExists": true,
    "needsInteraction": true,
    "buildPromptIfNeeded": "Only fill this if componentExists is false — describe what to build"
  },${!isMaths && isGP ? `
  "guidedPracticeNotes": "describe the method walkthrough",` : ""}
  "practiceQuestions": [
    { "question": "full question", "correctAnswer": "correct", "wrongAnswer1": "wrong 1", "wrongAnswer2": "wrong 2", "coachHint": "hint that teaches", "objective": "The student can ..." },
    { "question": "", "correctAnswer": "", "wrongAnswer1": "", "wrongAnswer2": "", "coachHint": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswer1": "", "wrongAnswer2": "", "coachHint": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswer1": "", "wrongAnswer2": "", "coachHint": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswer1": "", "wrongAnswer2": "", "coachHint": "", "objective": "" }
  ],
  "challengeQuestions": [
    { "question": "unfamiliar scenario", "correctAnswer": "", "wrongAnswers": ["", "", ""], "reasoningPath": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswers": ["", "", ""], "reasoningPath": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswers": ["", "", ""], "reasoningPath": "", "objective": "" },
    { "question": "", "correctAnswer": "", "wrongAnswers": ["", "", ""], "reasoningPath": "", "objective": "" }
  ]
}

Rules:
- interactionRef.componentExists = true if HeatSlider fits this concept, false if a new component would be needed
- If componentExists is false, describe what to build in buildPromptIfNeeded
- Every question fully written. Wrong answers = real misconceptions. Output JSON only.`;
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
  const pqs = concept.practiceQuestions ?? [];
  const setPQ = (i: number, patch: Partial<PracticeQuestion>) => {
    const qs = [...pqs]; qs[i] = { ...qs[i], ...patch };
    onChange({ ...concept, practiceQuestions: qs });
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
  const hasContent = !!concept.guidedLearningMission || (concept.practiceQuestions?.length ?? 0) > 0;
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
    { key: "pq", label: `Practice (${concept.practiceQuestions?.length ?? 0})`, done: (concept.practiceQuestions?.length ?? 0) > 0, colour: "#7c3aed" },
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