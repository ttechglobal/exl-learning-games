// FILE: src/app/(admin)/admin/content/[topicId]/MobilePreview.tsx
"use client";

import React, { useState, lazy, Suspense } from "react";
import type { HeatSliderConfig } from "@/components/interactions/HeatSlider";

// Lazy-load interaction components
const COMPONENTS: Record<string, React.ComponentType<{ config: Record<string, unknown>; colour?: string }>> = {
  HeatSlider:           lazy(() => import("@/components/interactions/HeatSlider")),
  MatterSorter:         lazy(() => import("@/components/interactions/MatterSorter")),
  InfiniteZoomExplorer: lazy(() => import("@/components/interactions/InfiniteZoomExplorer")),
};

interface PracticeQuestion {
  question: string;
  correctAnswer: string;
  wrongAnswer1: string;
  wrongAnswer2: string;
  coachHint: string;
}

interface ChallengeQuestion {
  question: string;
  correctAnswer: string;
  wrongAnswers: string[];
  reasoningPath: string;
}

interface GuidedLearningMission {
  missionName: string;
  coachBriefing: string[];
  interaction: { whatStudentDoes: string; whatSystemShows: string; keyMoment: string };
  coachLines: { atKeyMoment: string; onSuccess: string };
  objectives: string[];
}

interface InteractionRef {
  component: string;
  config: Record<string, unknown>;
  componentExists?: boolean;
  needsInteraction?: boolean;
  buildPromptIfNeeded?: string;
}

interface PreviewConcept {
  name: string;
  stage: string;
  guidedLearningMission?: GuidedLearningMission;
  practiceQuestions?: PracticeQuestion[];
  challengeQuestions?: ChallengeQuestion[];
  interactionRef?: InteractionRef | null;
}

interface Props {
  concept: PreviewConcept;
  subject: string;
  coach: string;
  colour: string;
  activeTab?: "gl" | "pq" | "cq";
  onTabChange?: (tab: "gl" | "pq" | "cq") => void;
}

type Screen = "gl" | "pq" | "cq";

const SUBJECT_GRADIENTS: Record<string, string> = {
  chemistry:   "linear-gradient(160deg, #0c2d48 0%, #0a1628 100%)",
  physics:     "linear-gradient(160deg, #1a0533 0%, #0d0820 100%)",
  mathematics: "linear-gradient(160deg, #062318 0%, #041810 100%)",
  biology:     "linear-gradient(160deg, #1a1000 0%, #0f0900 100%)",
};

// Lesson flow step types
type FlowStep =
  | { type: "coach"; cardIndex: number }
  | { type: "interaction" }
  | { type: "keyMoment" }
  | { type: "success" };

function buildLessonFlow(gl: GuidedLearningMission, hasInteraction: boolean): FlowStep[] {
  const steps: FlowStep[] = [];
  (gl.coachBriefing ?? []).forEach((_, i) => steps.push({ type: "coach", cardIndex: i }));
  if (hasInteraction) steps.push({ type: "interaction" });
  if (gl.coachLines?.atKeyMoment) steps.push({ type: "keyMoment" });
  if (gl.coachLines?.onSuccess) steps.push({ type: "success" });
  return steps;
}

// ── Guided Learning Preview — full lesson flow ─────────────────────────────────

function GLPreview({ concept, colour, coach, subject }: {
  concept: PreviewConcept;
  colour: string;
  coach: string;
  subject: string;
}) {
  const bg = SUBJECT_GRADIENTS[subject] ?? "linear-gradient(160deg, #0d1520 0%, #060d18 100%)";
  const gl  = concept.guidedLearningMission;
  const ref = concept.interactionRef;

  const LiveComponent = ref?.component && ref.componentExists !== false
    ? COMPONENTS[ref.component]
    : null;

  const hasInteraction = !!LiveComponent;
  const flow = gl ? buildLessonFlow(gl, hasInteraction) : [];
  const [stepIdx, setStepIdx] = useState(0);

  // Reset step when concept changes
  React.useEffect(() => { setStepIdx(0); }, [concept.name]);

  const step = flow[stepIdx];
  const isLast = stepIdx === flow.length - 1;
  const isFirst = stepIdx === 0;

  if (!gl && !ref) {
    return (
      <div style={{ background: bg, borderRadius: 16, padding: 40, minHeight: 400,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: "1.5rem", opacity: 0.12 }}>◈</div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.2)", textAlign: "center", lineHeight: 1.5 }}>
          Generate content first.<br />Claude will design the full lesson flow.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 440, overflow: "hidden" }}>

      {/* Top bar — mission name + step progress */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
          Guided Learning
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>
          {gl?.missionName || "Mission"}
        </div>
        {/* Step dots */}
        {flow.length > 0 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {flow.map((s, i) => (
              <div key={i} onClick={() => setStepIdx(i)} style={{
                height: 4,
                width: i === stepIdx ? 20 : 6,
                borderRadius: 2,
                background: i <= stepIdx ? colour : "rgba(255,255,255,0.15)",
                cursor: "pointer", transition: "all 0.2s",
              }} />
            ))}
            <div style={{ marginLeft: "auto", fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>
              {stepIdx + 1}/{flow.length}
            </div>
          </div>
        )}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>

        {/* Coach card */}
        {step?.type === "coach" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: `${colour}20`, border: `2px solid ${colour}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>🧑‍🔬</div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>{coach}</div>
                <div style={{ fontSize: "0.65rem", color: colour }}>Your guide</div>
              </div>
            </div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12,
              padding: 16, border: `1px solid ${colour}25`,
            }}>
              <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.88)", lineHeight: 1.7 }}>
                {gl?.coachBriefing?.[step.cardIndex] ?? ""}
              </div>
            </div>
          </div>
        )}

        {/* Interaction step */}
        {step?.type === "interaction" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Your turn — interact
            </div>
            {LiveComponent ? (
              <Suspense fallback={
                <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.78rem" }}>
                  Loading…
                </div>
              }>
                <LiveComponent config={(ref?.config ?? {}) as HeatSliderConfig} colour={colour} />
              </Suspense>
            ) : ref?.componentExists === false ? (
              <div style={{ padding: 16, background: "rgba(180,83,9,0.1)", borderRadius: 10, border: "1px solid rgba(180,83,9,0.25)" }}>
                <div style={{ fontSize: "0.7rem", color: "#b45309", fontWeight: 700, marginBottom: 6 }}>⚠ Component not built yet</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                  {ref?.buildPromptIfNeeded || `A new interaction component is needed for this concept.`}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Key moment */}
        {step?.type === "keyMoment" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: `${colour}20`, border: `2px solid ${colour}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>🧑‍🔬</div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>{coach}</div>
                <div style={{ fontSize: "0.65rem", color: colour }}>Key moment</div>
              </div>
            </div>
            <div style={{
              background: `${colour}12`, borderRadius: 12, padding: 16,
              border: `1px solid ${colour}30`, borderLeft: `4px solid ${colour}`,
            }}>
              <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.88)", lineHeight: 1.7, fontStyle: "italic" }}>
                &quot;{gl?.coachLines?.atKeyMoment}&quot;
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {step?.type === "success" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center", paddingTop: 20 }}>
            <div style={{ fontSize: "2.5rem" }}>🎯</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>Well done!</div>
            <div style={{
              background: "rgba(5,150,105,0.12)", borderRadius: 12, padding: 16,
              border: "1px solid rgba(5,150,105,0.25)", width: "100%",
            }}>
              <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontStyle: "italic" }}>
                &quot;{gl?.coachLines?.onSuccess}&quot;
              </div>
            </div>
            {(gl?.objectives ?? []).filter(Boolean).length > 0 && (
              <div style={{ width: "100%", textAlign: "left" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>
                  What you learned
                </div>
                {gl!.objectives.filter(Boolean).map((obj, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                    <div style={{ color: "#34d399", flexShrink: 0, marginTop: 2 }}>✓</div>
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{obj}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {flow.length > 1 && (
        <div style={{
          display: "flex", gap: 8, padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
        }}>
          <button onClick={() => setStepIdx(s => Math.max(0, s - 1))} disabled={isFirst} style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
            color: isFirst ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
            fontSize: "0.78rem", cursor: isFirst ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>← Back</button>
          <button onClick={() => setStepIdx(s => Math.min(flow.length - 1, s + 1))} disabled={isLast} style={{
            flex: 1, padding: "8px 16px", borderRadius: 8, border: "none",
            background: isLast ? "rgba(255,255,255,0.05)" : colour,
            color: isLast ? "rgba(255,255,255,0.2)" : "#fff",
            fontSize: "0.82rem", fontWeight: 700, cursor: isLast ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {isLast ? "Complete" : step?.type === "coach" ? "Next →" : step?.type === "interaction" ? "Done →" : "Continue →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Practice Question Preview ─────────────────────────────────────────────────

function PQPreview({ questions, colour, coach, subject }: {
  questions: PracticeQuestion[];
  colour: string;
  coach: string;
  subject: string;
}) {
  const [qi, setQi]             = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const bg = SUBJECT_GRADIENTS[subject] ?? "linear-gradient(160deg, #0d1520 0%, #060d18 100%)";
  const q = questions[qi];

  const reset = (newQi: number) => { setQi(newQi); setSelected(null); setShowHint(false); };

  if (!q) return <EmptyState label="No practice questions yet" icon="○" subject={subject} />;

  const options = [
    { label: q.correctAnswer, correct: true },
    { label: q.wrongAnswer1,  correct: false },
    { label: q.wrongAnswer2,  correct: false },
  ].filter(o => o.label);

  return (
    <div style={{ background: bg, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16, minHeight: 400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.12em" }}>Practice</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>{qi + 1} / {questions.length}</div>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${((qi+1)/questions.length)*100}%`, background: colour, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: "0.95rem", color: "#fff", lineHeight: 1.6 }}>{q.question}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => {
          const isSelected  = selected === opt.label;
          const showResult  = selected !== null;
          return (
            <button key={i} onClick={() => !selected && setSelected(opt.label)} style={{
              padding: "13px 16px", borderRadius: 10, textAlign: "left",
              background: showResult && opt.correct ? `${colour}25` : isSelected ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${showResult && opt.correct ? colour : isSelected ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
              color: showResult && opt.correct ? colour : "rgba(255,255,255,0.85)",
              fontSize: "0.88rem", cursor: selected ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", transition: "all 0.15s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: showResult && opt.correct ? colour : isSelected ? "#ef4444" : "rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.65rem", color: "#fff", fontWeight: 800,
              }}>
                {showResult && opt.correct ? "✓" : showResult && isSelected ? "✗" : ""}
              </div>
              <span style={{ fontWeight: showResult && opt.correct ? 700 : 400 }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {!selected && q.coachHint && (
        <button onClick={() => setShowHint(h => !h)} style={{
          background: "none", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8,
          padding: "9px 14px", color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", cursor: "pointer", textAlign: "left",
        }}>{showHint ? "Hide hint ↑" : "💡 Need a hint?"}</button>
      )}
      {showHint && q.coachHint && (
        <div style={{ background: `${colour}12`, border: `1px solid ${colour}25`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: "0.65rem", color: colour, fontWeight: 800, marginBottom: 5 }}>🧑‍🔬 {coach}</div>
          <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{q.coachHint}</div>
        </div>
      )}
      {selected && (
        <button onClick={() => qi < questions.length - 1 ? reset(qi + 1) : reset(0)} style={{
          padding: "13px", borderRadius: 12, border: "none", background: colour,
          color: "#fff", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
        }}>{qi < questions.length - 1 ? "Next question →" : "↺ Start over"}</button>
      )}
    </div>
  );
}

// ── Challenge Question Preview ────────────────────────────────────────────────

function CQPreview({ questions, subject }: { questions: ChallengeQuestion[]; subject: string }) {
  const [qi, setQi]             = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const bg = SUBJECT_GRADIENTS[subject] ?? "linear-gradient(160deg, #0d1520 0%, #060d18 100%)";
  const q = questions[qi];

  if (!q) return <EmptyState label="No challenge questions yet" icon="△" subject={subject} />;

  const options = [
    { label: q.correctAnswer, correct: true },
    ...(q.wrongAnswers ?? []).filter(Boolean).map(w => ({ label: w, correct: false })),
  ];

  return (
    <div style={{ background: bg, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16, minHeight: 400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.12em" }}>Challenge</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>{qi + 1} / {questions.length}</div>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${((qi+1)/questions.length)*100}%`, background: "#ef4444", borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ background: "rgba(239,68,68,0.07)", borderRadius: 12, padding: 18, border: "1px solid rgba(239,68,68,0.15)" }}>
        <div style={{ fontSize: "0.65rem", color: "#ef4444", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>⏱ Think carefully</div>
        <div style={{ fontSize: "0.95rem", color: "#fff", lineHeight: 1.6 }}>{q.question}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => {
          const isSelected = selected === opt.label;
          const showResult = selected !== null;
          return (
            <button key={i} onClick={() => !selected && setSelected(opt.label)} style={{
              padding: "13px 16px", borderRadius: 10, textAlign: "left",
              background: showResult && opt.correct ? "rgba(5,150,105,0.15)" : isSelected ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${showResult && opt.correct ? "#059669" : isSelected ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
              color: showResult && opt.correct ? "#34d399" : "rgba(255,255,255,0.85)",
              fontSize: "0.88rem", cursor: selected ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}>{opt.label}</button>
          );
        })}
      </div>
      {selected && q.reasoningPath && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 5, textTransform: "uppercase" }}>Reasoning</div>
          <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{q.reasoningPath}</div>
        </div>
      )}
      {selected && (
        <button onClick={() => { setQi(qi < questions.length - 1 ? qi + 1 : 0); setSelected(null); }} style={{
          padding: "13px", borderRadius: 12, border: "none", background: "#ef4444",
          color: "#fff", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
        }}>{qi < questions.length - 1 ? "Next →" : "↺ Start over"}</button>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, icon, subject }: { label: string; icon: string; subject: string }) {
  const bg = SUBJECT_GRADIENTS[subject] ?? "linear-gradient(160deg, #0d1520 0%, #060d18 100%)";
  return (
    <div style={{
      background: bg, borderRadius: 16,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 60, gap: 10, minHeight: 400,
    }}>
      <div style={{ fontSize: "2rem", opacity: 0.12 }}>{icon}</div>
      <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>{label}</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ContentPreview({ concept, subject, coach, colour, activeTab, onTabChange }: Props) {
  const [screen, setScreen] = useState<Screen>(activeTab ?? "gl");

  React.useEffect(() => { if (activeTab) setScreen(activeTab); }, [activeTab]);

  const hasGL = !!concept.guidedLearningMission || concept.interactionRef !== undefined;
  const hasPQ = (concept.practiceQuestions?.length ?? 0) > 0;
  const hasCQ = (concept.challengeQuestions?.length ?? 0) > 0;

  const tabs: { key: Screen; label: string; has: boolean; accent: string }[] = [
    { key: "gl", label: "Interaction",                                          has: hasGL, accent: colour },
    { key: "pq", label: `Practice (${concept.practiceQuestions?.length ?? 0})`, has: hasPQ, accent: "#7c3aed" },
    { key: "cq", label: `Challenge (${concept.challengeQuestions?.length ?? 0})`,has: hasCQ, accent: "#ef4444" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: "var(--surface)", borderRadius: "10px 10px 0 0",
        border: "1px solid var(--border)", borderBottom: "none",
      }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Student preview
        </div>
        <div style={{ fontSize: "0.62rem", color: "var(--text-4)" }}>Interactive</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderBottom: "none", overflow: "hidden" }}>
        {tabs.map((t, i) => (
          <button key={t.key} onClick={() => { setScreen(t.key); onTabChange?.(t.key); }} style={{
            flex: 1, padding: "9px 6px", border: "none",
            borderRight: i < tabs.length - 1 ? "1px solid var(--border)" : "none",
            background: screen === t.key ? `${t.accent}18` : "transparent",
            color: screen === t.key ? t.accent : "var(--text-4)",
            fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            borderBottom: screen === t.key ? `2px solid ${t.accent}` : "2px solid transparent",
            opacity: t.has || screen === t.key ? 1 : 0.45, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
        {screen === "gl" && (
          <GLPreview concept={concept} colour={colour} coach={coach} subject={subject} />
        )}
        {screen === "pq" && (
          hasPQ
            ? <PQPreview questions={concept.practiceQuestions!} colour={colour} coach={coach} subject={subject} />
            : <EmptyState label="No Practice questions yet" icon="○" subject={subject} />
        )}
        {screen === "cq" && (
          hasCQ
            ? <CQPreview questions={concept.challengeQuestions!} subject={subject} />
            : <EmptyState label="No Challenge questions yet" icon="△" subject={subject} />
        )}
      </div>
    </div>
  );
}