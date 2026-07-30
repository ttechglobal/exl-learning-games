// FILE: src/engines/cross-subject/mcq/MCQEngine.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  // Per-answer explanations: keyed by answer text
  answerExplanations?: Record<string, string>;
  // Single correct-answer explanation (shown after answering)
  correctExplanation?: string;
}

interface SharedConfig {
  coach?: string;
  accentColour?: string;
  subject?: string;
  topicName?: string;
  studentName?: string;
  currentMissionIndex?: number;
  allSessionMissions?: SessionMission[];
}

interface SessionMission {
  id: string;
  title: string;
  missionKey: string;
  sequenceIndex: number;
  payload: MCQPayload;
}

export interface MCQConfig {
  shared: SharedConfig;
  mission: {
    payload: MCQPayload;
    title?: string;
    difficulty?: string;
    xp_reward?: number;
    allSessionMissions?: SessionMission[];
    currentMissionIndex?: number;
  };
}

export interface MCQOutcome {
  success: boolean;
  correct: boolean;
  attempts: number;
  /** When true, GameRuntime skips the Reflection screen and advances
   *  directly to the next mission — used for mid-session questions
   *  where showing Mission Complete between every question would break
   *  the flow. Only the last question in a concept group sets this false. */
  autoAdvance?: boolean;
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

export function MCQEngine({
  config, onComplete, menu,
}: EngineRuntimeProps<MCQConfig, MCQOutcome> & { menu?: React.ReactNode }) {
  const shared      = (config.shared ?? {}) as SharedConfig;
  const mission     = config.mission;
  const payload     = (mission?.payload ?? {}) as MCQPayload;
  const subject     = shared.subject ?? "chemistry";
  const coach       = shared.coach ?? "Adaobi";
  const accent      = shared.accentColour ?? SUBJECT_ACCENT[subject] ?? "#0284c7";
  const bg          = SUBJECT_BG[subject] ?? SUBJECT_BG.chemistry;
  const isMaths     = subject === "mathematics";
  const isChallenge = mission?.difficulty === "HARD";

  const textMain = isMaths ? "#1a0a00" : "#ffffff";
  const textDim  = isMaths ? "rgba(90,64,16,0.7)" : "rgba(255,255,255,0.55)";
  const cardBg   = isMaths ? "rgba(255,253,240,0.97)" : "rgba(10,22,38,0.92)";
  const cardBorder = isMaths ? "rgba(201,162,39,0.25)" : "rgba(255,255,255,0.09)";

  // Shuffle once per mount
  const [options] = useState(() => shuffle([
    { label: payload.correctAnswer, correct: true },
    ...(payload.wrongAnswers ?? []).filter(Boolean).map(w => ({ label: w, correct: false })),
  ]));

  const [selected, setSelected]     = useState<string | null>(null);
  const [attempts, setAttempts]     = useState(0);
  const [showHint, setShowHint]     = useState(false);
  const [phase, setPhase]           = useState<"think" | "answer">(isChallenge ? "think" : "answer");
  const [thinkTimer, setThinkTimer] = useState(30);
  const [showViewAll, setShowViewAll] = useState(false);
  const [advancing, setAdvancing]   = useState(false);

  const currentIndex = (shared.currentMissionIndex ?? mission?.currentMissionIndex) ?? 0;
  const allMissions  = (shared.allSessionMissions ?? mission?.allSessionMissions) ?? [];

  // Challenge think-phase countdown
  useEffect(() => {
    if (phase !== "think") return;
    if (thinkTimer <= 0) { setPhase("answer"); return; }
    const t = setTimeout(() => setThinkTimer(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, thinkTimer]);

  const isCorrect  = selected !== null && options.find(o => o.label === selected)?.correct;
  const showResult = selected !== null;

  // Resolve the explanation to show after answering
  const getExplanation = useCallback((chosenLabel: string) => {
    // Per-answer explanation takes priority
    if (payload.answerExplanations?.[chosenLabel]) {
      return payload.answerExplanations[chosenLabel];
    }
    // Correct answer: use correctExplanation or reasoningPath
    const opt = options.find(o => o.label === chosenLabel);
    if (opt?.correct) {
      return payload.correctExplanation ?? payload.reasoningPath ?? null;
    }
    // Wrong answer: fall back to hint
    return payload.coachHint ?? null;
  }, [payload, options]);

  const handleSelect = (label: string) => {
    if (selected) return;
    setSelected(label);
    setAttempts(a => a + 1);
  };

  const handleNext = () => {
    if (advancing) return;
    setAdvancing(true);
    // autoAdvance: true tells GameRuntime to skip the Reflection screen
    // and go straight to the next mission when there are more questions
    // in this session. Only the LAST question in a concept group shows
    // the Reflection/Mission Complete screen.
    const isLastInSession = allMissions.length === 0 || currentIndex + 1 >= allMissions.length;
    onComplete({
      success: true,
      correct: !!isCorrect,
      attempts,
      autoAdvance: !isLastInSession,
    });
  };

  // ── View-all panel ────────────────────────────────────────────────────────
  if (showViewAll && allMissions.length > 0) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setShowViewAll(false)} style={{
            width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${accent}40`,
            background: `${accent}15`, color: accent, fontSize: "1rem",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {isChallenge ? "Challenge" : "Practice"} · {payload.conceptName ?? ""}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: textMain }}>All questions</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {allMissions.map((m, i) => {
            const isDone    = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12, marginBottom: 8,
                background: isCurrent ? `${accent}15` : isDone ? "rgba(5,150,105,0.08)" : cardBg,
                border: `1.5px solid ${isCurrent ? accent : isDone ? "rgba(5,150,105,0.3)" : cardBorder}`,
                opacity: i > currentIndex ? 0.45 : 1,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: isDone ? "rgba(5,150,105,0.2)" : isCurrent ? `${accent}20` : "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${isDone ? "#059669" : isCurrent ? accent : "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.78rem", fontWeight: 800,
                  color: isDone ? "#34d399" : isCurrent ? accent : textDim,
                }}>
                  {isDone ? "✓" : i > currentIndex ? "🔒" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: isDone ? textDim : textMain, lineHeight: 1.4 }}>
                    {(m.payload as MCQPayload).question?.slice(0, 80)}{(m.payload as MCQPayload).question?.length > 80 ? "…" : ""}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: isDone ? "#34d399" : isCurrent ? accent : textDim, marginTop: 2, fontWeight: 600 }}>
                    {isDone ? "Done" : isCurrent ? "Up next" : "Locked"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  const explanation = selected ? getExplanation(selected) : null;

  return (
    <div style={{ background: bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* ── TOPBAR — menu LEFT, info right ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px",
        borderBottom: `1px solid ${cardBorder}`,
        flexShrink: 0,
      }}>
        {/* Menu button — LEFT */}
        {menu && <div style={{ flexShrink: 0, marginRight: 4 }}>{menu}</div>}

        {/* Difficulty badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.12em", color: isChallenge ? "#ef4444" : accent,
          padding: "3px 10px", borderRadius: 20,
          background: isChallenge ? "rgba(239,68,68,0.12)" : `${accent}15`,
          border: `1px solid ${isChallenge ? "rgba(239,68,68,0.3)" : `${accent}30`}`,
          flexShrink: 0,
        }}>
          {isChallenge ? "⚡ Challenge" : "✏️ Practice"}
        </div>

        {/* Concept name */}
        {payload.conceptName && (
          <div style={{ flex: 1, fontSize: "0.75rem", color: textDim, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {payload.conceptName}
          </div>
        )}

        {/* Progress */}
        {allMissions.length > 1 && (
          <div style={{ fontSize: "0.72rem", color: textDim, fontWeight: 700, flexShrink: 0 }}>
            {currentIndex + 1} / {allMissions.length}
          </div>
        )}

        {/* View all */}
        {allMissions.length > 1 && (
          <button onClick={() => setShowViewAll(true)} style={{
            padding: "4px 10px", borderRadius: 8, border: `1px solid ${accent}30`,
            background: `${accent}10`, color: accent, fontSize: "0.66rem",
            fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>All ▾</button>
        )}
      </div>

      {/* Progress bar */}
      {allMissions.length > 1 && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{
            height: "100%",
            width: `${((currentIndex + (showResult && isCorrect ? 1 : 0)) / allMissions.length) * 100}%`,
            background: accent, transition: "width 0.4s",
          }} />
        </div>
      )}

      {/* ── THINK PHASE (Challenge only) ── */}
      {phase === "think" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px", gap: 18 }}>
          {/* Big question card */}
          <div style={{
            background: cardBg, borderRadius: 20, padding: "28px 24px",
            border: `1.5px solid rgba(239,68,68,0.25)`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              ⏱ Think first — {thinkTimer}s
            </div>
            <div style={{ fontSize: "1.05rem", color: textMain, lineHeight: 1.75, fontWeight: 500 }}>
              {payload.question}
            </div>
          </div>
          <div style={{ fontSize: "0.85rem", color: textDim, textAlign: "center", lineHeight: 1.6 }}>
            Work it out in your head first. Take your time.
          </div>
          <button onClick={() => setPhase("answer")} style={{
            padding: "16px", borderRadius: 14, border: "none",
            background: accent, color: "#fff", fontSize: "1rem", fontWeight: 800,
            cursor: "pointer", boxShadow: `0 5px 0 ${accent}60`,
            marginTop: "auto",
          }}>I&apos;m ready →</button>
        </div>
      )}

      {/* ── ANSWER PHASE ── */}
      {phase === "answer" && (
        <div style={{ flex: 1, padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>

          {/* Question — big card */}
          <div style={{
            background: cardBg,
            borderRadius: 20,
            padding: "22px 22px",
            border: `1.5px solid ${cardBorder}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: "1.05rem", color: textMain, lineHeight: 1.75, fontWeight: 500 }}>
              {payload.question}
            </div>
          </div>

          {/* Options — big game-feel chips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {options.map((opt, i) => {
              const isSel   = selected === opt.label;
              const reveal  = showResult;
              const isRight = opt.correct;
              const isWrong = isSel && !opt.correct;

              // Colours
              let borderCol = `${accent}25`;
              let bgCol     = cardBg;
              let textCol   = textMain;
              let shadowCol = "transparent";

              if (reveal) {
                if (isRight) {
                  borderCol = "#22c55e";
                  bgCol     = isMaths ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.12)";
                  textCol   = "#22c55e";
                  shadowCol = "rgba(34,197,94,0.2)";
                } else if (isWrong) {
                  borderCol = "#ef4444";
                  bgCol     = isMaths ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.12)";
                  textCol   = "#ef4444";
                }
              } else {
                // Hover feel when not answered
                bgCol = isMaths ? "rgba(255,253,240,0.97)" : "rgba(255,255,255,0.06)";
              }

              return (
                <button key={i} onClick={() => handleSelect(opt.label)}
                  disabled={!!selected}
                  style={{
                    padding: "18px 20px",
                    borderRadius: 16,
                    textAlign: "left",
                    background: bgCol,
                    border: `2px solid ${borderCol}`,
                    color: textCol,
                    fontSize: "0.97rem",
                    cursor: selected ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontFamily: "inherit",
                    fontWeight: reveal && isRight ? 700 : 500,
                    transition: "all 0.18s ease",
                    boxShadow: reveal && isRight ? `0 4px 20px ${shadowCol}` : "none",
                    // Push-button feel
                    borderBottom: reveal ? `2px solid ${borderCol}` : `4px solid ${accent}30`,
                    transform: selected && !isRight && !isSel ? "scale(0.98)" : "scale(1)",
                    opacity: reveal && !isRight && !isSel ? 0.5 : 1,
                  }}
                >
                  {/* Letter badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: reveal && isRight ? "#22c55e"
                      : reveal && isWrong ? "#ef4444"
                      : `${accent}18`,
                    border: `2px solid ${reveal && isRight ? "#22c55e"
                      : reveal && isWrong ? "#ef4444"
                      : `${accent}35`}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: reveal ? "1rem" : "0.78rem",
                    color: reveal ? "#fff" : accent,
                    fontWeight: 900,
                    transition: "all 0.18s",
                  }}>
                    {reveal && isRight ? "✓" : reveal && isWrong ? "✗" : String.fromCharCode(65 + i)}
                  </div>
                  <span style={{ flex: 1, lineHeight: 1.5 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── POST-ANSWER EXPLANATION ── */}
          {showResult && explanation && (
            <div style={{
              borderRadius: 16,
              padding: "16px 18px",
              background: isCorrect
                ? "rgba(34,197,94,0.08)"
                : "rgba(239,68,68,0.08)",
              border: `1.5px solid ${isCorrect ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
              animation: "fadeUp 0.25s ease both",
            }}>
              <div style={{
                fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 8,
                color: isCorrect ? "#22c55e" : "#f87171",
              }}>
                {isCorrect ? "✓ That's right!" : "✗ Not quite"} — Here's why:
              </div>
              <div style={{ fontSize: "0.9rem", color: textMain, lineHeight: 1.65, fontWeight: 500 }}>
                {explanation}
              </div>
              {/* Coach attribution */}
              <div style={{ fontSize: "0.65rem", color: textDim, marginTop: 8, fontWeight: 600 }}>
                — {coach}
              </div>
            </div>
          )}

          {/* Hint (pre-answer, practice only) */}
          {!isChallenge && !selected && payload.coachHint && (
            <button onClick={() => setShowHint(h => !h)} style={{
              background: "none",
              border: `1.5px dashed ${accent}30`,
              borderRadius: 12, padding: "10px 14px",
              color: textDim, fontSize: "0.82rem",
              cursor: "pointer", textAlign: "left",
            }}>
              {showHint ? "Hide hint ↑" : `💡 Hint from ${coach}`}
            </button>
          )}
          {showHint && payload.coachHint && (
            <div style={{
              background: `${accent}10`,
              border: `1.5px solid ${accent}25`,
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ fontSize: "0.68rem", color: accent, fontWeight: 800, marginBottom: 6 }}>
                🧑‍🔬 {coach}
              </div>
              <div style={{ fontSize: "0.9rem", color: textMain, lineHeight: 1.65 }}>
                {payload.coachHint}
              </div>
            </div>
          )}

          {/* ── NEXT BUTTON — always shown after answering, whether right or wrong ── */}
          {showResult && (
            <button
              onClick={handleNext}
              disabled={advancing}
              style={{
                padding: "18px",
                borderRadius: 16,
                border: "none",
                background: isCorrect ? "#22c55e" : accent,
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 900,
                cursor: advancing ? "default" : "pointer",
                boxShadow: `0 5px 0 ${isCorrect ? "#15803d" : accent}80`,
                transition: "transform 0.1s, box-shadow 0.1s",
                opacity: advancing ? 0.7 : 1,
                marginTop: 4,
                letterSpacing: "0.02em",
                fontFamily: "var(--eg-font-display, 'Baloo 2', sans-serif)",
              }}
            >
              {currentIndex + 1 >= allMissions.length ? "Finish ✓" : "Next question →"}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}