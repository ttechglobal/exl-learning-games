"use client";

/**
 * MissionsClient.tsx — Change of Subject admin panel
 *
 * Redesigned for the StepwiseEngine payload shape:
 * {
 *   formula, goal, topic, finalAnswer,
 *   steps: [{
 *     trailLabel, resultEq,
 *     coach, coachWrong, hint,
 *     choiceQuestion,
 *     choices: [{ icon, label, sub, correct }]  ← exactly 4, exactly 1 correct
 *   }]
 * }
 *
 * All formula/equation fields accept LaTeX (rendered by KaTeX in the engine).
 * Coach fields accept plain text with optional <strong> or <em> tags.
 */

import { useState } from "react";
import Link from "next/link";
import type { GameRow, MissionRow } from "@/types/db";
import styles from "./missions.module.css";

const DIFF_COLOUR: Record<string, string> = {
  EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444",
};

const DIFF_LABEL: Record<string, string> = {
  EASY: "Guided (Easy)", MEDIUM: "Practice (Medium)", HARD: "Challenge (Hard)",
};

const ICONS = ["➕","➖","✖️","➗","⬛","✅","🔡","⬆️","⬇️","🔁"];

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0a1018", border: "1px solid #1e2535",
  borderRadius: 8, padding: "8px 12px",
  color: "#e2e8f0", fontSize: "0.85rem",
  outline: "none", fontFamily: "inherit",
};

const label: React.CSSProperties = {
  fontSize: "0.68rem", color: "#64748b",
  marginBottom: 5, textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Choice {
  icon: string;
  label: string;
  sub: string;
  correct: boolean;
}

interface Step {
  trailLabel: string;
  resultEq: string;
  coach: string;
  coachWrong: string;
  hint: string;
  choiceQuestion: string;
  choices: Choice[];
}

function emptyChoice(correct: boolean): Choice {
  return { icon: "➖", label: "", sub: "", correct };
}

function emptyStep(): Step {
  return {
    trailLabel: "",
    resultEq: "",
    coach: "",
    coachWrong: "",
    hint: "",
    choiceQuestion: "What's the next step?",
    choices: [
      emptyChoice(true),
      emptyChoice(false),
      emptyChoice(false),
      emptyChoice(false),
    ],
  };
}

// ─── ChoiceRow ────────────────────────────────────────────────────────────────

function ChoiceRow({
  choice, idx, stepIdx, isCorrect,
  onUpdate, onMarkCorrect,
}: {
  choice: Choice;
  idx: number;
  stepIdx: number;
  isCorrect: boolean;
  onUpdate: (patch: Partial<Choice>) => void;
  onMarkCorrect: () => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 32px 1fr 1fr auto",
      gap: 6, alignItems: "center",
      background: isCorrect ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isCorrect ? "rgba(34,197,94,0.25)" : "#1e2535"}`,
      borderRadius: 8, padding: "6px 8px", marginBottom: 5,
    }}>
      {/* Correct toggle */}
      <button
        title="Mark as correct answer"
        onClick={onMarkCorrect}
        style={{
          width: 28, height: 28, borderRadius: "50%", border: "none",
          background: isCorrect ? "#22c55e" : "#1e2535",
          color: isCorrect ? "#fff" : "#475569",
          cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✓</button>

      {/* Icon picker */}
      <select
        value={choice.icon}
        onChange={e => onUpdate({ icon: e.target.value })}
        style={{ ...inp, padding: "4px", textAlign: "center", fontSize: "1rem", width: 36 }}
      >
        {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
      </select>

      {/* Label (LaTeX ok) */}
      <input
        style={inp}
        value={choice.label}
        onChange={e => onUpdate({ label: e.target.value })}
        placeholder="Divide both sides by a"
      />

      {/* Sub */}
      <input
        style={{ ...inp, fontSize: "0.78rem", color: "#94a3b8" }}
        value={choice.sub}
        onChange={e => onUpdate({ sub: e.target.value })}
        placeholder="inverse of ×a"
      />

      <div style={{ fontSize: "0.65rem", color: isCorrect ? "#22c55e" : "#475569", whiteSpace: "nowrap" }}>
        {isCorrect ? "✓ correct" : "wrong"}
      </div>
    </div>
  );
}

// ─── StepBuilder ──────────────────────────────────────────────────────────────

function StepBuilder({
  steps, onChange,
}: {
  steps: Step[];
  onChange: (s: Step[]) => void;
}) {
  const update = (i: number, patch: Partial<Step>) => {
    onChange(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const updateChoice = (stepIdx: number, choiceIdx: number, patch: Partial<Choice>) => {
    const newChoices = steps[stepIdx].choices.map((c, ci) =>
      ci === choiceIdx ? { ...c, ...patch } : c
    );
    update(stepIdx, { choices: newChoices });
  };

  const markCorrect = (stepIdx: number, choiceIdx: number) => {
    const newChoices = steps[stepIdx].choices.map((c, ci) => ({
      ...c, correct: ci === choiceIdx,
    }));
    update(stepIdx, { choices: newChoices });
  };

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} style={{
          background: "#0a1018", border: "1px solid #1e2535",
          borderRadius: 12, padding: 16, marginBottom: 12,
        }}>
          {/* Step header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f5a623" }}>
              Step {i + 1} {i === steps.length - 1 ? "· 🏁 Final" : ""}
            </span>
            <button
              onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.75rem" }}
            >
              Remove
            </button>
          </div>

          {/* Trail label + Result equation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={label}>Trail label</div>
              <input style={inp} value={step.trailLabel} placeholder="Subtract u from both sides"
                onChange={e => update(i, { trailLabel: e.target.value })} />
            </div>
            <div>
              <div style={label}>Result equation (LaTeX)</div>
              <input style={inp} value={step.resultEq} placeholder="v - u = at"
                onChange={e => update(i, { resultEq: e.target.value })} />
            </div>
          </div>

          {/* Choice question */}
          <div style={{ marginBottom: 10 }}>
            <div style={label}>Choice question (shown above buttons)</div>
            <input style={inp} value={step.choiceQuestion} placeholder="What removes u from the right side?"
              onChange={e => update(i, { choiceQuestion: e.target.value })} />
          </div>

          {/* Coach text */}
          <div style={{ marginBottom: 10 }}>
            <div style={label}>Coach explanation — shown before the student picks (HTML ok: &lt;strong&gt;, &lt;em&gt;)</div>
            <textarea
              style={{ ...inp, minHeight: 60, resize: "vertical" as const }}
              value={step.coach}
              placeholder="u is being <strong>added</strong> to at. To move it, subtract u from both sides — it cancels on the right."
              onChange={e => update(i, { coach: e.target.value })}
            />
          </div>

          {/* Coach wrong */}
          <div style={{ marginBottom: 10 }}>
            <div style={label}>Coach re-prompt — shown after a wrong pick</div>
            <textarea
              style={{ ...inp, minHeight: 48, resize: "vertical" as const }}
              value={step.coachWrong}
              placeholder="Look at the right side: u + at. Which term has no t? That one needs to move first."
              onChange={e => update(i, { coachWrong: e.target.value })}
            />
          </div>

          {/* Hint */}
          <div style={{ marginBottom: 12 }}>
            <div style={label}>Hint — shown in Practice mode on tap</div>
            <input style={inp} value={step.hint} placeholder="u is being added. The inverse of addition is subtraction."
              onChange={e => update(i, { hint: e.target.value })} />
          </div>

          {/* Choices */}
          <div>
            <div style={{ ...label, marginBottom: 8 }}>
              Choices — click ✓ to mark the correct one (exactly 1 correct)
            </div>
            {step.choices.map((ch, ci) => (
              <ChoiceRow
                key={ci}
                choice={ch}
                idx={ci}
                stepIdx={i}
                isCorrect={ch.correct}
                onUpdate={patch => updateChoice(i, ci, patch)}
                onMarkCorrect={() => markCorrect(i, ci)}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange([...steps, emptyStep()])}
        style={{
          background: "none", border: "1px dashed #2a3a4a",
          borderRadius: 8, padding: "8px 16px",
          color: "#64748b", fontSize: "0.8rem", cursor: "pointer", width: "100%",
        }}
      >
        + Add step
      </button>
    </div>
  );
}

// ─── AddMissionForm ───────────────────────────────────────────────────────────

function AddMissionForm({
  gameId, sequenceIndex, onSaved, onCancel, accent,
}: {
  gameId: string;
  sequenceIndex: number;
  onSaved: (m: MissionRow) => void;
  onCancel: () => void;
  accent: string;
}) {
  const [title,       setTitle]       = useState("");
  const [difficulty,  setDifficulty]  = useState<"EASY"|"MEDIUM"|"HARD">("EASY");
  const [xpReward,    setXpReward]    = useState(20);
  const [formula,     setFormula]     = useState("");
  const [goal,        setGoal]        = useState("");
  const [topic,       setTopic]       = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [steps, setSteps]             = useState<Step[]>([emptyStep()]);
  const [saving, setSaving]           = useState(false);
  const [error,  setError]            = useState<string | null>(null);

  // Validate before save
  const validate = (): string | null => {
    if (!title.trim())       return "Title is required.";
    if (!formula.trim())     return "Formula is required.";
    if (!goal.trim())        return "Goal is required (e.g. 'Make t the subject').";
    if (!finalAnswer.trim()) return "Final answer is required.";
    if (steps.length === 0)  return "At least one step is required.";
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s.trailLabel.trim()) return `Step ${i+1}: Trail label is required.`;
      if (!s.resultEq.trim())   return `Step ${i+1}: Result equation is required.`;
      if (!s.coach.trim())      return `Step ${i+1}: Coach explanation is required.`;
      if (!s.coachWrong.trim()) return `Step ${i+1}: Coach re-prompt is required.`;
      if (!s.hint.trim())       return `Step ${i+1}: Hint is required.`;
      const correctCount = s.choices.filter(c => c.correct).length;
      if (correctCount !== 1)   return `Step ${i+1}: Exactly one choice must be marked correct (currently ${correctCount}).`;
      for (let j = 0; j < s.choices.length; j++) {
        if (!s.choices[j].label.trim()) return `Step ${i+1}, Choice ${j+1}: Label is required.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError(null);

    const missionKey = `cos-${Date.now()}`;
    const payload = { formula, goal, topic, finalAnswer, steps };

    const res = await fetch(`/api/games/${gameId}/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionKey, title, difficulty, sequenceIndex, xpReward,
        topicId: "change-of-subject-formula",
        learningGoal, payload,
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

      {/* Title / Difficulty / XP */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={label}>Title *</div>
          <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="World 1 · Undo Addition" />
        </div>
        <div>
          <div style={label}>Difficulty *</div>
          <select style={{ ...inp, cursor: "pointer" }} value={difficulty} onChange={e => setDifficulty(e.target.value as "EASY"|"MEDIUM"|"HARD")}>
            {(["EASY","MEDIUM","HARD"] as const).map(d => (
              <option key={d} value={d}>{DIFF_LABEL[d]}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={label}>XP reward</div>
          <input style={inp} type="number" value={xpReward} onChange={e => setXpReward(Number(e.target.value))} />
        </div>
      </div>

      {/* Formula / Goal / Topic */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={label}>Formula (LaTeX) *</div>
          <input style={inp} value={formula} onChange={e => setFormula(e.target.value)} placeholder="v = u + at" />
        </div>
        <div>
          <div style={label}>Goal *</div>
          <input style={inp} value={goal} onChange={e => setGoal(e.target.value)} placeholder="Make t the subject" />
        </div>
        <div>
          <div style={label}>Topic</div>
          <input style={inp} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Kinematics" />
        </div>
      </div>

      {/* Final answer */}
      <div style={{ marginBottom: 14 }}>
        <div style={label}>Final answer (LaTeX) *</div>
        <input style={inp} value={finalAnswer} onChange={e => setFinalAnswer(e.target.value)} placeholder="t = \frac{v - u}{a}" />
        <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: 4 }}>
          Use LaTeX: \frac{"{a}{b}"} for fractions · ^2 for squared · \sqrt{"{x}"} for roots · \pi for π
        </div>
      </div>

      {/* Learning goal */}
      <div style={{ marginBottom: 18 }}>
        <div style={label}>Learning goal (shown on narration screen)</div>
        <input style={inp} value={learningGoal} onChange={e => setLearningGoal(e.target.value)} placeholder="Isolate a variable by subtracting a constant from both sides." />
      </div>

      {/* Steps */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...label, marginBottom: 8, fontSize: "0.72rem", color: "#94a3b8" }}>
          STEPS * — each step is one operation. The student picks from 4 choices.
        </div>
        <StepBuilder steps={steps} onChange={setSteps} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "8px 12px", color: "#fca5a5",
          fontSize: "0.8rem", marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "10px 28px", borderRadius: 9,
          background: saving ? "#1e2535" : accent,
          color: saving ? "#64748b" : "#fff",
          fontWeight: 700, fontSize: "0.88rem",
          border: "none", cursor: saving ? "default" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Save Mission"}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MissionsClient({
  game, initialMissions,
}: {
  game: GameRow;
  initialMissions: MissionRow[];
}) {
  const [missions, setMissions] = useState<MissionRow[]>(initialMissions);
  const [adding,   setAdding]   = useState(false);
  const accent = game.accent_colour ?? "#7c3aed";

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
          <p className={styles.sub}>
            {missions.length} missions ·{" "}
            <a href={`/play/${game.slug}`} target="_blank" style={{ color: "#64748b" }}>Preview ↗</a>
          </p>
          <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 4 }}>
            EASY = Guided · MEDIUM = Practice · HARD = Challenge
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/admin/games/${game.id}/engine`} className={styles.btnSecondary}>⚙ Engine</Link>
          <Link href={`/admin/games/${game.id}/edit`}   className={styles.btnSecondary}>Edit Game</Link>
        </div>
      </div>

      <div className={styles.accentBar} style={{ background: accent }} />

      {/* Mission list */}
      {missions.length > 0 && (
        <div className={styles.missionList}>
          {missions.map((m, i) => {
            const p = m.payload as Record<string, unknown>;
            return (
              <div key={m.id} className={styles.missionRow}>
                <div className={styles.missionNum} style={{ borderColor: `${accent}40` }}>{i + 1}</div>
                <div className={styles.missionInfo}>
                  <div className={styles.missionTitle}>{m.title}</div>
                  <div className={styles.missionMeta}>
                    {typeof p.formula === "string" && (
                      <span className={styles.metaFormula}>{p.formula}</span>
                    )}
                    {typeof p.goal === "string" && (
                      <span className={styles.metaTarget}>→ {p.goal}</span>
                    )}
                    {Array.isArray(p.steps) && (
                      <span className={styles.metaGoal}>{(p.steps as unknown[]).length} step{(p.steps as unknown[]).length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <div className={styles.missionRight}>
                  <span
                    className={styles.diffBadge}
                    style={{ color: DIFF_COLOUR[m.difficulty] ?? "#64748b", borderColor: `${DIFF_COLOUR[m.difficulty] ?? "#64748b"}30` }}
                  >
                    {m.difficulty}
                  </span>
                  <span className={styles.xpBadge}>{m.xp_reward} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
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
        <button
          onClick={() => setAdding(true)}
          className={styles.addBtn}
          style={{ borderColor: `${accent}40`, color: accent }}
        >
          + Add Mission
        </button>
      )}
    </div>
  );
}