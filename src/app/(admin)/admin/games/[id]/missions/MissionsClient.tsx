// FILE: src/app/(admin)/admin/games/[id]/missions/MissionsClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { GameRow, MissionRow } from "@/types/db";
import styles from "./missions.module.css";

const DIFF_COLOUR: Record<string, string> = {
  EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444", MASTERY: "#a855f7",
};

const DIFF_LABEL: Record<string, string> = {
  EASY: "Guided", MEDIUM: "Practice", HARD: "Challenge", MASTERY: "Mastery",
};

const ICONS = ["➕","➖","✖️","➗","⬛","✅","🔡","⬆️","⬇️","🔁"];

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0a1018", border: "1px solid #1e2535",
  borderRadius: 8, padding: "8px 12px",
  color: "#e2e8f0", fontSize: "0.85rem",
  outline: "none", fontFamily: "inherit",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "0.68rem", color: "#64748b",
  marginBottom: 5, textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

interface Choice { icon: string; label: string; sub: string; correct: boolean; }
interface Step {
  trailLabel: string; resultEq: string; coach: string;
  coachWrong: string; hint: string; choiceQuestion: string; choices: Choice[];
}

function emptyChoice(correct: boolean): Choice {
  return { icon: "➖", label: "", sub: "", correct };
}
function emptyStep(): Step {
  return {
    trailLabel: "", resultEq: "", coach: "", coachWrong: "", hint: "",
    choiceQuestion: "What's the next step?",
    choices: [emptyChoice(true), emptyChoice(false), emptyChoice(false), emptyChoice(false)],
  };
}

function ChoiceRow({ choice, isCorrect, onUpdate, onMarkCorrect }: {
  choice: Choice; isCorrect: boolean;
  onUpdate: (p: Partial<Choice>) => void; onMarkCorrect: () => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 32px 1fr 1fr auto",
      gap: 6, alignItems: "center",
      background: isCorrect ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isCorrect ? "rgba(34,197,94,0.25)" : "#1e2535"}`,
      borderRadius: 8, padding: "6px 8px", marginBottom: 5,
    }}>
      <button onClick={onMarkCorrect} style={{
        width: 28, height: 28, borderRadius: "50%", border: "none",
        background: isCorrect ? "#22c55e" : "#1e2535",
        color: isCorrect ? "#fff" : "#475569",
        cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>✓</button>
      <select value={choice.icon} onChange={e => onUpdate({ icon: e.target.value })}
        style={{ ...inp, padding: "4px", textAlign: "center", fontSize: "1rem", width: 36 }}>
        {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
      </select>
      <input style={inp} value={choice.label} onChange={e => onUpdate({ label: e.target.value })} placeholder="Divide both sides by a" />
      <input style={{ ...inp, fontSize: "0.78rem", color: "#94a3b8" }} value={choice.sub} onChange={e => onUpdate({ sub: e.target.value })} placeholder="inverse of ×a" />
      <div style={{ fontSize: "0.65rem", color: isCorrect ? "#22c55e" : "#475569", whiteSpace: "nowrap" }}>
        {isCorrect ? "✓ correct" : "wrong"}
      </div>
    </div>
  );
}

function StepBuilder({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const update = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateChoice = (si: number, ci: number, patch: Partial<Choice>) => {
    const newChoices = steps[si].choices.map((c, j) => j === ci ? { ...c, ...patch } : c);
    update(si, { choices: newChoices });
  };
  const markCorrect = (si: number, ci: number) => {
    update(si, { choices: steps[si].choices.map((c, j) => ({ ...c, correct: j === ci })) });
  };

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} style={{ background: "#0a1018", border: "1px solid #1e2535", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f5a623" }}>
              Step {i + 1} {i === steps.length - 1 ? "· 🏁 Final" : ""}
            </span>
            <button onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.75rem" }}>
              Remove
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><div style={fieldLabel}>Trail label</div>
              <input style={inp} value={step.trailLabel} placeholder="Subtract u from both sides" onChange={e => update(i, { trailLabel: e.target.value })} /></div>
            <div><div style={fieldLabel}>Result equation (LaTeX)</div>
              <input style={inp} value={step.resultEq} placeholder="v - u = at" onChange={e => update(i, { resultEq: e.target.value })} /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={fieldLabel}>Choice question</div>
            <input style={inp} value={step.choiceQuestion} onChange={e => update(i, { choiceQuestion: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={fieldLabel}>Coach explanation</div>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" as const }} value={step.coach} onChange={e => update(i, { coach: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={fieldLabel}>Coach re-prompt (after wrong pick)</div>
            <textarea style={{ ...inp, minHeight: 48, resize: "vertical" as const }} value={step.coachWrong} onChange={e => update(i, { coachWrong: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabel}>Hint</div>
            <input style={inp} value={step.hint} onChange={e => update(i, { hint: e.target.value })} />
          </div>
          <div>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>Choices — click ✓ to mark correct</div>
            {step.choices.map((ch, ci) => (
              <ChoiceRow key={ci} choice={ch} isCorrect={ch.correct}
                onUpdate={patch => updateChoice(i, ci, patch)}
                onMarkCorrect={() => markCorrect(i, ci)} />
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...steps, emptyStep()])}
        style={{ background: "none", border: "1px dashed #2a3a4a", borderRadius: 8, padding: "8px 16px", color: "#64748b", fontSize: "0.8rem", cursor: "pointer", width: "100%" }}>
        + Add step
      </button>
    </div>
  );
}

function AddMissionForm({ gameId, sequenceIndex, onSaved, onCancel, accent }: {
  gameId: string; sequenceIndex: number;
  onSaved: (m: MissionRow) => void; onCancel: () => void; accent: string;
}) {
  const [title, setTitle]             = useState("");
  const [difficulty, setDifficulty]   = useState<"EASY"|"MEDIUM"|"HARD">("EASY");
  const [xpReward, setXpReward]       = useState(20);
  const [formula, setFormula]         = useState("");
  const [goal, setGoal]               = useState("");
  const [topic, setTopic]             = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [steps, setSteps]             = useState<Step[]>([emptyStep()]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const validate = (): string | null => {
    if (!title.trim())       return "Title is required.";
    if (!formula.trim())     return "Formula is required.";
    if (!goal.trim())        return "Goal is required.";
    if (!finalAnswer.trim()) return "Final answer is required.";
    if (steps.length === 0)  return "At least one step is required.";
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.trailLabel.trim()) return `Step ${i+1}: Trail label required.`;
      if (!s.resultEq.trim())   return `Step ${i+1}: Result equation required.`;
      if (!s.coach.trim())      return `Step ${i+1}: Coach explanation required.`;
      if (!s.coachWrong.trim()) return `Step ${i+1}: Coach re-prompt required.`;
      if (!s.hint.trim())       return `Step ${i+1}: Hint required.`;
      const correctCount = s.choices.filter(c => c.correct).length;
      if (correctCount !== 1) return `Step ${i+1}: Exactly one correct choice required.`;
      for (let j = 0; j < s.choices.length; j++) {
        if (!s.choices[j].label.trim()) return `Step ${i+1}, Choice ${j+1}: Label required.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    const res = await fetch(`/api/games/${gameId}/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionKey: `cos-${Date.now()}`, title, difficulty, sequenceIndex, xpReward,
        topicId: "change-of-subject-formula", learningGoal,
        payload: { formula, goal, topic, finalAnswer, steps },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
    onSaved(json.mission);
  };

  return (
    <div style={{ background: "#111827", border: `1px solid ${accent}30`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>New Mission</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.8rem" }}>Cancel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><div style={fieldLabel}>Title *</div><input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="World 1 · Undo Addition" /></div>
        <div><div style={fieldLabel}>Difficulty *</div>
          <select style={{ ...inp, cursor: "pointer" }} value={difficulty} onChange={e => setDifficulty(e.target.value as "EASY"|"MEDIUM"|"HARD")}>
            {(["EASY","MEDIUM","HARD"] as const).map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
          </select></div>
        <div><div style={fieldLabel}>XP reward</div><input style={inp} type="number" value={xpReward} onChange={e => setXpReward(Number(e.target.value))} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><div style={fieldLabel}>Formula (LaTeX) *</div><input style={inp} value={formula} onChange={e => setFormula(e.target.value)} placeholder="v = u + at" /></div>
        <div><div style={fieldLabel}>Goal *</div><input style={inp} value={goal} onChange={e => setGoal(e.target.value)} placeholder="Make t the subject" /></div>
        <div><div style={fieldLabel}>Topic</div><input style={inp} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Kinematics" /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={fieldLabel}>Final answer (LaTeX) *</div>
        <input style={inp} value={finalAnswer} onChange={e => setFinalAnswer(e.target.value)} placeholder="t = \frac{v - u}{a}" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={fieldLabel}>Learning goal</div>
        <input style={inp} value={learningGoal} onChange={e => setLearningGoal(e.target.value)} placeholder="Isolate a variable by subtracting a constant from both sides." />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...fieldLabel, marginBottom: 8, fontSize: "0.72rem", color: "#94a3b8" }}>STEPS *</div>
        <StepBuilder steps={steps} onChange={setSteps} />
      </div>
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#fca5a5", fontSize: "0.8rem", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button onClick={handleSave} disabled={saving} style={{
        padding: "10px 28px", borderRadius: 9,
        background: saving ? "#1e2535" : accent,
        color: saving ? "#64748b" : "#fff",
        fontWeight: 700, fontSize: "0.88rem", border: "none", cursor: saving ? "default" : "pointer",
      }}>
        {saving ? "Saving…" : "Save Mission"}
      </button>
    </div>
  );
}

// ── Collapsible mission row ───────────────────────────────────────────────────

function MissionRow({ mission, index, accent }: { mission: MissionRow; index: number; accent: string }) {
  const [open, setOpen] = useState(false);
  const p = mission.payload as Record<string, unknown>;
  const colour = DIFF_COLOUR[mission.difficulty] ?? "#64748b";

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden", marginBottom: 8,
    }}>
      {/* Header — always visible, click to toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.72rem", fontWeight: 800, color: accent, flexShrink: 0,
        }}>{index + 1}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            {mission.title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {typeof p.formula === "string" && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-3)", fontFamily: "monospace" }}>{p.formula}</span>
            )}
            {typeof p.goal === "string" && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-4)" }}>→ {p.goal}</span>
            )}
            {Array.isArray(p.steps) && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-4)" }}>{(p.steps as unknown[]).length} steps</span>
            )}
            {mission.learning_goal && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontStyle: "italic" }}>{mission.learning_goal}</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px",
            borderRadius: 20, border: `1px solid ${colour}30`,
            color: colour, background: `${colour}10`,
          }}>{DIFF_LABEL[mission.difficulty] ?? mission.difficulty}</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-4)" }}>{mission.xp_reward} XP</span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-4)" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded payload */}
      {open && (
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "14px 16px",
          background: "var(--surface-2)",
        }}>
          <pre style={{
            margin: 0, fontSize: "0.72rem", color: "var(--text-3)",
            fontFamily: "SF Mono, Fira Code, monospace",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            lineHeight: 1.6, maxHeight: 400, overflowY: "auto",
          }}>
            {JSON.stringify(mission.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MissionsClient({ game, initialMissions }: {
  game: GameRow; initialMissions: MissionRow[];
}) {
  const [missions, setMissions] = useState<MissionRow[]>(initialMissions);
  const [adding, setAdding]     = useState(false);
  const [allOpen, setAllOpen]   = useState(false);
  const accent = game.accent_colour ?? "#7c3aed";

  // Group by difficulty for summary
  const counts = missions.reduce((acc, m) => {
    acc[m.difficulty] = (acc[m.difficulty] ?? 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <Link href="/admin/games" className={styles.breadLink}>Games</Link>
            <span className={styles.sep}>/</span>
            <Link href={`/admin/games/${game.id}/edit`} className={styles.breadLink}>{game.title}</Link>
            <span className={styles.sep}>/</span>
            <span>Missions</span>
          </div>
          <h1 className={styles.heading}>Missions</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{missions.length} total</span>
            {Object.entries(counts).map(([diff, count]) => (
              <span key={diff} style={{
                fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px",
                borderRadius: 20, border: `1px solid ${DIFF_COLOUR[diff] ?? "#64748b"}30`,
                color: DIFF_COLOUR[diff] ?? "#64748b",
              }}>{count} {DIFF_LABEL[diff] ?? diff}</span>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/admin/games/${game.id}/engine`} className={styles.btnSecondary}>⚙ Engine</Link>
          <Link href={`/admin/games/${game.id}/edit`} className={styles.btnSecondary}>Edit</Link>
          <a href={`/play/${game.slug}`} target="_blank" className={styles.btnSecondary}>Play ↗</a>
        </div>
      </div>

      <div className={styles.accentBar} style={{ background: accent }} />

      {missions.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button
              onClick={() => setAllOpen(o => !o)}
              style={{
                background: "none", border: "1px solid var(--border)",
                borderRadius: 6, padding: "5px 12px",
                fontSize: "0.75rem", color: "var(--text-3)", cursor: "pointer",
              }}
            >
              {allOpen ? "Collapse all ▲" : "Expand all ▼"}
            </button>
          </div>
          {/* Key trick: change the key to force remount when allOpen toggles, 
              so all MissionRow components reinitialise with the new default */}
          <div key={String(allOpen)}>
            {missions.map((m, i) => (
              <MissionRow key={m.id} mission={m} index={i} accent={accent} />
            ))}
          </div>
        </>
      )}

      {adding ? (
        <div style={{ marginTop: 16 }}>
          <AddMissionForm
            gameId={game.id}
            sequenceIndex={missions.length + 1}
            onSaved={m => { setMissions([...missions, m]); setAdding(false); }}
            onCancel={() => setAdding(false)}
            accent={accent}
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className={styles.addBtn}
          style={{ borderColor: `${accent}40`, color: accent }}>
          + Add Mission
        </button>
      )}
    </div>
  );
}