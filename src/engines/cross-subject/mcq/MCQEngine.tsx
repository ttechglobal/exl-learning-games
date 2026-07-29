// FILE: src/engines/cross-subject/mcq/MCQEngine.tsx
"use client";

/**
 * MCQEngine — renders a SESSION of MCQ missions for a concept.
 *
 * A "session" = all missions of the same difficulty for the same concept.
 * The engine receives ONE mission at a time from GameRuntime (the active
 * mission), but internally drives a multi-question flow by calling
 * onComplete after each answer, which advances PlayClient to the next mission.
 *
 * The session view shows all questions and locks future ones until the
 * previous is answered. Completed ones can be redone.
 */

import React, { useState, useEffect } from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";

interface MCQPayload {
  type: "mcq";
  question: string;
  correctAnswer: string;
  wrongAnswers: string[];
  coachHint?: string;
  objective?: string;
  reasoningPath?: string;
  conceptName?: string;
}

interface SharedConfig {
  coach?: string;
  accentColour?: string;
  subject?: string;
  topicName?: string;
  studentName?: string;
  currentMissionIndex?: number;
  allSessionMissions?: Array<{
    id: string;
    title: string;
    missionKey: string;
    sequenceIndex: number;
    payload: MCQPayload;
  }>;
}

export interface MCQConfig {
  shared: SharedConfig;
  mission: {
    payload: MCQPayload;
    title?: string;
    difficulty?: string;
    xp_reward?: number;
    // All missions in this session (same difficulty, same concept group)
    allSessionMissions?: Array<{
      id: string;
      title: string;
      missionKey: string;
      sequenceIndex: number;
      payload: MCQPayload;
    }>;
    currentMissionIndex?: number;
  };
}

export interface MCQOutcome {
  success: boolean;
  correct: boolean;
  attempts: number;
}

const SUBJECT_ACCENT: Record<string, string> = {
  chemistry:   "#00d4ff",
  physics:     "#4488ff",
  mathematics: "#c9a227",
  biology:     "#7ecf3e",
};

const SUBJECT_BG: Record<string, string> = {
  chemistry:   "linear-gradient(160deg, #041418 0%, #061e24 100%)",
  physics:     "linear-gradient(160deg, #080820 0%, #0c1040 100%)",
  mathematics: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 100%)",
  biology:     "linear-gradient(160deg, #081a06 0%, #0f2a08 100%)",
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

interface QuestionState {
  answered: boolean;
  correct: boolean;
  selectedAnswer: string | null;
}

export function MCQEngine({
  config, onComplete, menu,
}: EngineRuntimeProps<MCQConfig, MCQOutcome> & { menu?: React.ReactNode }) {
  const shared  = (config.shared ?? {}) as SharedConfig;
  const mission = config.mission;
  const payload = (mission?.payload ?? {}) as MCQPayload;
  const subject = shared.subject ?? "chemistry";
  const coach   = shared.coach ?? "Dr. Adaobi";
  const accent  = shared.accentColour ?? SUBJECT_ACCENT[subject] ?? "#0284c7";
  const bg      = SUBJECT_BG[subject] ?? SUBJECT_BG.chemistry;
  const isMaths = subject === "mathematics";
  const isChallenge = mission?.difficulty === "HARD";
  const conceptName = payload.conceptName ?? "";

  const textMain = isMaths ? "#1a0a00" : "#ffffff";
  const textDim  = isMaths ? "rgba(90,64,16,0.7)" : "rgba(255,255,255,0.55)";
  const cardBg   = isMaths ? "rgba(255,253,240,0.95)" : "rgba(6,14,26,0.85)";

  // Shuffle options once per mount
  const [options] = useState(() => shuffle([
    { label: payload.correctAnswer, correct: true },
    ...(payload.wrongAnswers ?? []).filter(Boolean).map(w => ({ label: w, correct: false })),
  ]));

  const [selected, setSelected] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase]       = useState<"think" | "answer">(isChallenge ? "think" : "answer");
  const [thinkTimer, setThinkTimer] = useState(30);
  const [showViewAll, setShowViewAll] = useState(false);

  // Challenge think phase countdown
  useEffect(() => {
    if (phase !== "think") return;
    if (thinkTimer <= 0) { setPhase("answer"); return; }
    const t = setTimeout(() => setThinkTimer(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, thinkTimer]);

  const isCorrect  = selected !== null && options.find(o => o.label === selected)?.correct;
  const showResult = selected !== null;

  const handleSelect = (label: string) => {
    if (selected) return;
    setSelected(label);
    setAttempts(a => a + 1);
  };

  const handleTryAgain = () => {
    setSelected(null);
    setShowHint(false);
  };

  const handleNext = () => {
    onComplete({ success: true, correct: !!isCorrect, attempts });
  };

  // ── View all panel ────────────────────────────────────────────────────────

  // Session data comes from sharedConfig (injected by PlayClient)
  const currentIndex = (shared.currentMissionIndex ?? mission?.currentMissionIndex) ?? 0;
  const allMissions  = (shared.allSessionMissions ?? mission?.allSessionMissions) ?? [];

  if (showViewAll && allMissions.length > 0) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setShowViewAll(false)} style={{
            width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${accent}40`,
            background: `${accent}15`, color: accent, fontSize: "1rem",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {isChallenge ? "Challenge" : "Practice"} · {conceptName}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: textMain }}>
              All questions
            </div>
          </div>
        </div>

        {/* Question list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {allMissions.map((m, i) => {
            const isDone    = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isLocked  = i > currentIndex;
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12, marginBottom: 8,
                background: isCurrent ? `${accent}15` : isDone ? "rgba(5,150,105,0.08)" : cardBg,
                border: `1.5px solid ${isCurrent ? accent : isDone ? "rgba(5,150,105,0.3)" : "rgba(255,255,255,0.06)"}`,
                opacity: isLocked ? 0.45 : 1,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: isDone ? "rgba(5,150,105,0.2)" : isCurrent ? `${accent}20` : "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${isDone ? "#059669" : isCurrent ? accent : "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.78rem", fontWeight: 800,
                  color: isDone ? "#34d399" : isCurrent ? accent : textDim,
                }}>
                  {isDone ? "✓" : isLocked ? "🔒" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: isDone ? textDim : textMain, lineHeight: 1.4 }}>
                    {(m.payload as MCQPayload).question?.slice(0, 80)}{(m.payload as MCQPayload).question?.length > 80 ? "…" : ""}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: isDone ? "#34d399" : isCurrent ? accent : textDim, marginTop: 2, fontWeight: 600 }}>
                    {isDone ? "Completed — tap to redo" : isCurrent ? "Up next" : "Complete previous to unlock"}
                  </div>
                </div>
                {(isDone || isCurrent) && (
                  <div style={{ color: `${accent}60`, fontSize: "0.9rem" }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Main question UI ──────────────────────────────────────────────────────

  return (
    <div style={{ background: bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Difficulty + concept */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.12em", color: accent,
            padding: "3px 10px", borderRadius: 20,
            background: `${accent}15`, border: `1px solid ${accent}30`,
            marginBottom: 3,
          }}>
            {isChallenge ? "⚡ Challenge" : "✏️ Practice"}
          </div>
          {conceptName && (
            <div style={{ fontSize: "0.78rem", color: textDim, fontWeight: 600 }}>{conceptName}</div>
          )}
        </div>

        {/* Progress fraction */}
        {allMissions.length > 1 && (
          <div style={{ fontSize: "0.72rem", color: textDim, fontWeight: 600, flexShrink: 0 }}>
            {currentIndex + 1} / {allMissions.length}
          </div>
        )}

        {/* View all */}
        {allMissions.length > 1 && (
          <button onClick={() => setShowViewAll(true)} style={{
            padding: "5px 10px", borderRadius: 8, border: `1px solid ${accent}30`,
            background: `${accent}10`, color: accent, fontSize: "0.68rem",
            fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>All ▾</button>
        )}

        {/* Menu */}
        {menu && <div style={{ flexShrink: 0 }}>{menu}</div>}
      </div>

      {/* Progress bar */}
      {allMissions.length > 1 && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{
            height: "100%",
            width: `${((currentIndex + (showResult && isCorrect ? 1 : 0)) / allMissions.length) * 100}%`,
            background: accent, transition: "width 0.4s",
          }} />
        </div>
      )}

      {/* Challenge think phase */}
      {phase === "think" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", gap: 16 }}>
          <div style={{ background: cardBg, borderRadius: 16, padding: 20, border: `1.5px solid ${accent}25`, backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", marginBottom: 8 }}>
              ⏱ Think first — {thinkTimer}s
            </div>
            <div style={{ fontSize: "1rem", color: textMain, lineHeight: 1.7 }}>{payload.question}</div>
          </div>
          <div style={{ fontSize: "0.82rem", color: textDim, textAlign: "center", lineHeight: 1.5 }}>
            Work it out first. When ready, pick your answer.
          </div>
          <button onClick={() => setPhase("answer")} style={{
            padding: "14px", borderRadius: 12, border: "none",
            background: accent, color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
          }}>I&apos;m ready →</button>
        </div>
      )}

      {/* Answer phase */}
      {phase === "answer" && (
        <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>

          {/* Question */}
          <div style={{
            background: cardBg, borderRadius: 14, padding: 18,
            border: `1px solid ${accent}20`, backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: "1rem", color: textMain, lineHeight: 1.7 }}>{payload.question}</div>
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => {
              const isSel  = selected === opt.label;
              const reveal = showResult;
              const bgCol  = reveal
                ? opt.correct ? `${accent}22` : isSel ? "rgba(239,68,68,0.15)" : isMaths ? "rgba(255,253,240,0.6)" : "rgba(255,255,255,0.03)"
                : isMaths ? "rgba(255,253,240,0.9)" : "rgba(255,255,255,0.06)";
              return (
                <button key={i} onClick={() => handleSelect(opt.label)} style={{
                  padding: "14px 16px", borderRadius: 12, textAlign: "left",
                  background: bgCol,
                  border: `1.5px solid ${reveal ? opt.correct ? accent : isSel ? "#ef4444" : "rgba(255,255,255,0.06)" : `${accent}20`}`,
                  color: reveal && opt.correct ? accent : textMain,
                  fontSize: "0.92rem", cursor: selected ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                  fontFamily: "inherit", transition: "all 0.15s", backdropFilter: "blur(4px)",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: reveal && opt.correct ? accent : isSel && reveal ? "#ef4444" : `${accent}15`,
                    border: `1.5px solid ${reveal && opt.correct ? accent : isSel && reveal ? "#ef4444" : `${accent}30`}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", color: "#fff", fontWeight: 800,
                  }}>
                    {reveal && opt.correct ? "✓" : reveal && isSel && !opt.correct ? "✗" : String.fromCharCode(65 + i)}
                  </div>
                  <span style={{ fontWeight: reveal && opt.correct ? 700 : 400 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          {!isChallenge && !selected && payload.coachHint && (
            <button onClick={() => setShowHint(h => !h)} style={{
              background: "none", border: `1px dashed ${accent}30`, borderRadius: 10,
              padding: "9px 14px", color: textDim, fontSize: "0.8rem",
              cursor: "pointer", textAlign: "left",
            }}>
              {showHint ? "Hide hint ↑" : `💡 Hint from ${coach}`}
            </button>
          )}
          {showHint && payload.coachHint && (
            <div style={{ background: `${accent}12`, border: `1px solid ${accent}25`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: "0.7rem", color: accent, fontWeight: 800, marginBottom: 5 }}>🧑‍🔬 {coach}</div>
              <div style={{ fontSize: "0.88rem", color: textMain, lineHeight: 1.6 }}>{payload.coachHint}</div>
            </div>
          )}

          {/* Challenge reasoning */}
          {isChallenge && showResult && isCorrect && payload.reasoningPath && (
            <div style={{ background: "rgba(5,150,105,0.1)", borderRadius: 10, padding: 14, border: "1px solid rgba(5,150,105,0.2)" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#34d399", marginBottom: 5 }}>Reasoning</div>
              <div style={{ fontSize: "0.85rem", color: textMain, lineHeight: 1.6 }}>{payload.reasoningPath}</div>
            </div>
          )}

          {/* Result actions */}
          {showResult && (
            isCorrect ? (
              <button onClick={handleNext} style={{
                padding: "14px", borderRadius: 12, border: "none",
                background: accent, color: "#fff", fontSize: "0.95rem", fontWeight: 800,
                cursor: "pointer", boxShadow: `0 5px 0 ${accent}50`,
              }}>Next →</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: "0.82rem", color: "#f87171", textAlign: "center", fontWeight: 600 }}>
                  Not quite — {payload.coachHint && !showHint ? "check the hint!" : "have another go."}
                </div>
                <button onClick={handleTryAgain} style={{
                  padding: "12px", borderRadius: 12, border: "none",
                  background: `${accent}20`, color: accent,
                  fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                }}>Try again</button>
                <button onClick={handleNext} style={{
                  padding: "10px", borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`,
                  background: "transparent", color: textDim,
                  fontSize: "0.82rem", cursor: "pointer",
                }}>Skip this one →</button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}