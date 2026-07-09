"use client";

import { useState } from "react";
import Link from "next/link";
import type { GameRow, MissionRow } from "@/types/db";
import styles from "./missions.module.css";

const OPERATIONS = [
  { value: "divide_both",   label: "Divide both sides"        },
  { value: "multiply_both", label: "Multiply both sides"      },
  { value: "subtract_both", label: "Subtract from both sides" },
  { value: "add_both",      label: "Add to both sides"        },
  { value: "square_root",   label: "Square root both sides"   },
  { value: "square_both",   label: "Square both sides"        },
  { value: "cube_root",     label: "Cube root both sides"     },
  { value: "cube_both",     label: "Cube both sides"          },
];

const STAGES = [
  { value: "practice",  label: "Practice (Guided)"   },
  { value: "challenge", label: "Challenge (Hint/Assist on Request)" },
  { value: "master",    label: "Master (Independent)" },
];

const DIFF_COLOUR: Record<string, string> = {
  EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444",
};

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0a1018", border: "1px solid #1e2535",
  borderRadius: 8, padding: "8px 12px",
  color: "#e2e8f0", fontSize: "0.85rem",
  outline: "none", fontFamily: "inherit",
};

interface Step {
  operation: string;
  obstacleLabel: string;
  description: string;
  resultDisplay: string[];
  hints: [string, string, string];
  isFinal: boolean;
}

function StepBuilder({
  steps,
  onChange,
}: {
  steps: Step[];
  onChange: (s: Step[]) => void;
}) {
  const update = (i: number, patch: Partial<Step>) => {
    const next = steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    next.forEach((s, idx) => { s.isFinal = idx === next.length - 1; });
    onChange(next);
  };

  const add = () => {
    const next = [
      ...steps,
      {
        operation: "divide_both",
        obstacleLabel: "",
        description: "",
        resultDisplay: [""],
        hints: ["", "", ""] as [string, string, string],
        isFinal: true,
      },
    ];
    next.forEach((s, idx) => { s.isFinal = idx === next.length - 1; });
    onChange(next);
  };

  const remove = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i);
    next.forEach((s, idx) => { s.isFinal = idx === next.length - 1; });
    onChange(next);
  };

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            background: "#0a1018",
            border: "1px solid #1e2535",
            borderRadius: 10,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
              }}
            >
              Step {i + 1} {step.isFinal ? "· 🏁" : ""}
            </span>
            <button
              onClick={() => remove(i)}
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Remove
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Operation</div>
              <select
                style={{ ...inp, cursor: "pointer" }}
                value={step.operation}
                onChange={(e) => update(i, { operation: e.target.value })}
              >
                {OPERATIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Obstacle Label</div>
              <input
                style={inp}
                value={step.obstacleLabel}
                onChange={(e) => update(i, { obstacleLabel: e.target.value })}
                placeholder="π shield"
              />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Description (shown in log)</div>
            <input
              style={inp}
              value={step.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="Divide both sides by π"
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Result lines</div>
            {step.resultDisplay.map((line, j) => (
              <input
                key={j}
                style={{ ...inp, marginBottom: 5 }}
                value={line}
                onChange={(e) => {
                  const r = [...step.resultDisplay];
                  r[j] = e.target.value;
                  update(i, { resultDisplay: r });
                }}
                placeholder={`Result line ${j + 1}`}
              />
            ))}
            <button
              onClick={() => update(i, { resultDisplay: [...step.resultDisplay, ""] })}
              style={{ background: "none", border: "1px dashed #1e2535", borderRadius: 5, padding: "4px 10px", color: "#475569", fontSize: "0.7rem", cursor: "pointer" }}
            >
              + line
            </button>
          </div>

          <div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Hints (1=vague, 3=specific)</div>
            {(["Hint 1", "Hint 2", "Hint 3"] as const).map((_, j) => (
              <input
                key={j}
                style={{ ...inp, marginBottom: 5 }}
                value={step.hints[j]}
                onChange={(e) => {
                  const h = [...step.hints] as [string, string, string];
                  h[j] = e.target.value;
                  update(i, { hints: h });
                }}
                placeholder={`Hint ${j + 1}`}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={add}
        style={{
          background: "none",
          border: "1px dashed #2a3a4a",
          borderRadius: 8,
          padding: "8px 16px",
          color: "#64748b",
          fontSize: "0.8rem",
          cursor: "pointer",
          width: "100%",
        }}
      >
        + Add step
      </button>
    </div>
  );
}

function AddMissionForm({
  gameId,
  sequenceIndex,
  onSaved,
  onCancel,
  accent,
}: {
  gameId: string;
  sequenceIndex: number;
  onSaved: (m: MissionRow) => void;
  onCancel: () => void;
  accent: string;
}) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("EASY");
  const [xpReward, setXpReward] = useState(20);
  const [world, setWorld] = useState("");
  const [formula, setFormula] = useState("");
  const [targetVariable, setTargetVariable] = useState("");
  const [discoveryName, setDiscoveryName] = useState("");
  const [stage, setStage] = useState("practice");
  const [learningGoal, setLearningGoal] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { operation: "divide_both", obstacleLabel: "", description: "", resultDisplay: [""], hints: ["", "", ""], isFinal: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title || steps.length === 0) { setError("Title and at least one step required."); return; }
    setSaving(true); setError(null);

    const missionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const payload: Record<string, unknown> = {
      learningGoal,
      stage,
      excavationSteps: steps.map((s) => ({
        operation: s.operation,
        obstacleLabel: s.obstacleLabel,
        description: s.description,
        resultDisplay: s.resultDisplay.filter(Boolean),
        isFinal: s.isFinal,
      })),
      stepHints: steps.map((s) => s.hints.filter(Boolean)),
    };
    if (formula) payload.formula = formula;
    if (targetVariable) payload.targetVariable = targetVariable;
    if (world) payload.world = world;
    if (discoveryName) payload.discoveryName = discoveryName;

    const res = await fetch(`/api/games/${gameId}/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionKey, title, difficulty, sequenceIndex, xpReward, topicId: "change-of-subject", learningGoal, payload }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed"); return; }
    onSaved(json.mission);
  };

  return (
    <div style={{ background: "#111827", border: `1px solid ${accent}30`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>New Mission</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.8rem" }}>Cancel</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Title *</div>
          <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="World 1 · Formula 1"/>
        </div>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Difficulty</div>
          <select style={{ ...inp, cursor: "pointer" }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {["EASY","MEDIUM","HARD"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>XP</div>
          <input style={inp} type="number" value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))}/>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Formula</div>
          <input style={inp} value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="A = πr²"/>
        </div>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Target Variable</div>
          <input style={inp} value={targetVariable} onChange={(e) => setTargetVariable(e.target.value)} placeholder="r"/>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>World Label</div>
          <input style={inp} value={world} onChange={(e) => setWorld(e.target.value)} placeholder="World 4 — Power Peaks"/>
        </div>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Artifact Name</div>
          <input style={inp} value={discoveryName} onChange={(e) => setDiscoveryName(e.target.value)} placeholder="Area Relic"/>
        </div>
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Stage</div>
          <select style={{ ...inp, cursor: "pointer" }} value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 5, textTransform: "uppercase" }}>Learning Goal</div>
        <input style={inp} value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} placeholder="Divide by π then square root to isolate r"/>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Excavation Steps *</div>
        <StepBuilder steps={steps} onChange={setSteps} />
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#fca5a5", fontSize: "0.8rem", marginBottom: 12 }}>
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

export default function MissionsClient({
  game,
  initialMissions,
}: {
  game: GameRow;
  initialMissions: MissionRow[];
}) {
  const [missions, setMissions] = useState<MissionRow[]>(initialMissions);
  const [adding, setAdding] = useState(false);
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
          <p className={styles.sub}>{missions.length} missions · <a href={`/play/${game.slug}`} target="_blank" style={{ color: "#64748b" }}>Preview ↗</a></p>
        </div>
        <div className={styles.headerActions}>
          {(game as Record<string,unknown>).engine_pending && (
            <Link href={`/admin/games/${game.id}/engine`} className={styles.btnEngine}>
              ⚙ Build Engine
            </Link>
          )}
          {!(game as Record<string,unknown>).engine_pending && (
            <Link href={`/admin/games/${game.id}/engine`} className={styles.btnSecondary}>
              ⚙ Engine
            </Link>
          )}
          <Link href={`/admin/games/${game.id}/edit`} className={styles.btnSecondary}>Edit Game</Link>
        </div>
      </div>

      {(game as Record<string,unknown>).engine_pending && (
        <div className={styles.engineBanner}>
          <span>⚠ Engine <strong>{game.engine_type}</strong> is not yet registered — this game cannot be played until the engine is built.</span>
          <Link href={`/admin/games/${game.id}/engine`} className={styles.engineBannerLink}>
            View build instructions →
          </Link>
        </div>
      )}

      <div className={styles.accentBar} style={{ background: accent }}/>

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
                    {typeof p.formula === "string" && <span className={styles.metaFormula}>{p.formula}</span>}
                    {typeof p.targetVariable === "string" && <span className={styles.metaTarget}>→ {p.targetVariable}</span>}
                    {m.learning_goal && <span className={styles.metaGoal}>{m.learning_goal}</span>}
                  </div>
                </div>
                <div className={styles.missionRight}>
                  <span className={styles.diffBadge} style={{ color: DIFF_COLOUR[m.difficulty] ?? "#64748b", borderColor: `${DIFF_COLOUR[m.difficulty] ?? "#64748b"}30` }}>
                    {m.difficulty}
                  </span>
                  <span className={styles.xpBadge}>{m.xp_reward} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add mission */}
      {adding ? (
        <div style={{ marginTop: 16 }}>
          <AddMissionForm
            gameId={game.id}
            sequenceIndex={missions.length + 1}
            onSaved={(m) => { setMissions([...missions, m]); setAdding(false); }}
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