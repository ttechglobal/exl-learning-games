"use client";
/**
 * app/(player)/games/math-quest/page.tsx
 *
 * Wires MiniGolfEngine ↔ ChangeOfSubjectEngine via a focused glass overlay.
 *
 * Key design decisions:
 *  1. Golf canvas ALWAYS renders underneath — never hidden or unmounted.
 *  2. When hearts needed, a blurred-dimmed overlay appears on top.
 *  3. The learning activity runs in a glass card inside the overlay.
 *  4. Student can always escape back to golf with "Back to Golf" button.
 *  5. After completing the activity, overlay closes and golf resumes.
 *  6. autoStartTier="learn" skips the hub — student lands straight in a question.
 */

import { useRouter } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import { MiniGolfEngine } from "@/games/math-quest/MathQuestEngine";
import type { HeartRefillResult, RoundResult } from "@/games/math-quest/MathQuestEngine";
// Change-of-Subject engine not yet built — stubs keep this page compilable
type ChangeOfSubjectOutcome = { success: boolean; xpEarned?: number };
function ChangeOfSubjectEngine({ onComplete }: { config: unknown; onComplete: (o: ChangeOfSubjectOutcome) => void; autoStartTier?: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:16, textAlign:"center" }}>
      <div style={{ fontSize:32 }}>🚧</div>
      <div style={{ fontFamily:"sans-serif", fontWeight:700, fontSize:16 }}>Change of Subject — Coming Soon</div>
      <button onClick={() => onComplete({ success: false, xpEarned: 0 })}
        style={{ padding:"10px 24px", borderRadius:100, border:"none", background:"#1A4010", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
        Return to Golf ⛳
      </button>
    </div>
  );
}
function randomMissionForTier(_tier: string) {
  return [{ qLabel:"Make x the subject", formula:"y = mx + c", finalAnswer:"x = (y - c) / m", steps: [] }];
}

// ── Build a minimal config — one question, learn tier ────────────────────────
function buildLearningConfig() {
  const qs = randomMissionForTier("learn");
  const q = qs[Math.floor(Math.random() * qs.length)];
  return {
    shared: {
      pointsPerQuestion: 20,
      retryPenalty: 5,
      hintPenalty: 5,
      hintTimePenalty: 5,
      baseTimerSecs: 90,
      retryTimerCut: 10,
      minTimerSecs: 30,
      practiceTimerFromQ: 99,
    },
    mission: {
      id: `golf-hearts-${Date.now()}`,
      missionKey: "cos-learn-m1",
      title: "Earn Hearts",
      xpReward: 15,
      topicId: "change-of-subject",
      subtopicId: undefined,
      payload: { questions: [q] }, // exactly 1 question → onComplete fires immediately after
    },
  };
}

// ── Overlay shell ─────────────────────────────────────────────────────────────
interface OverlayShellProps {
  visible: boolean;
  onSkip: () => void;
  children: React.ReactNode;
}

function LearningOverlayShell({ visible, onSkip, children }: OverlayShellProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 90,
      backdropFilter: "blur(8px) brightness(0.5) saturate(0.6)",
      WebkitBackdropFilter: "blur(8px) brightness(0.5) saturate(0.6)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "12px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 24,
        width: "100%", maxWidth: 460, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.25)",
        overflow: "hidden",
        animation: "cardUp .28s cubic-bezier(.2,1.1,.4,1) both",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px",
          background: "linear-gradient(135deg, #1A4010, #2E6A20)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>⛳</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Baloo 2', sans-serif", fontWeight: 800,
              fontSize: 14, color: "#fff", lineHeight: 1,
            }}>
              Solve to earn hearts back ❤️❤️❤️
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>
              Complete the question — you'll return to golf automatically
            </div>
          </div>
          <button onClick={onSkip} style={{
            background: "rgba(255,255,255,.15)", border: "1.5px solid rgba(255,255,255,.3)",
            borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700,
            padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap",
            fontFamily: "inherit",
          }}>
            Skip ✕
          </button>
        </div>

        {/* Engine content */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px", borderTop: "1px solid #eee",
          background: "#fafaf8", flexShrink: 0,
        }}>
          <button onClick={onSkip} style={{
            width: "100%", padding: "10px 16px",
            borderRadius: 100, border: "1.5px solid #d4e0d0",
            background: "#f0f6ee", color: "#3A6A30",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}>
            ⛳ Back to Golf (no hearts restored)
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cardUp {
          from { transform: translateY(28px) scale(.96); opacity: 0; }
          to   { transform: translateY(0)    scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MathQuestGolfPage() {
  const router = useRouter();

  const [showLearning, setShowLearning] = useState(false);
  const [activityKey, setActivityKey]   = useState(0);
  const resolveRef = useRef<((r: HeartRefillResult) => void) | null>(null);

  const handleNeedHearts = useCallback((resolve: (r: HeartRefillResult) => void) => {
    resolveRef.current = resolve;
    setActivityKey(k => k + 1);
    setShowLearning(true);
  }, []);

  const handleLearningComplete = useCallback((outcome: ChangeOfSubjectOutcome) => {
    setShowLearning(false);
    resolveRef.current?.({ heartsGranted: 3, xpEarned: outcome.xpEarned ?? 15 });
    resolveRef.current = null;
  }, []);

  const handleSkip = useCallback(() => {
    setShowLearning(false);
    resolveRef.current?.({ heartsGranted: 0, xpEarned: 0 });
    resolveRef.current = null;
  }, []);

  const handleRoundEnd = useCallback((_result: RoundResult) => {
    // TODO: POST _result to /api/attempts
  }, []);

  // Build config once per activity mount (key change triggers fresh instance)
  const configRef = useRef(buildLearningConfig());
  const prevKey = useRef(activityKey);
  if (activityKey !== prevKey.current) {
    configRef.current = buildLearningConfig();
    prevKey.current = activityKey;
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <MiniGolfEngine
        onNeedHearts={handleNeedHearts}
        onRoundEnd={handleRoundEnd}
        onExit={() => router.push("/worlds")}
        heartsPerHole={3}
      />

      <LearningOverlayShell visible={showLearning} onSkip={handleSkip}>
        {showLearning && (
          <ChangeOfSubjectEngine
            key={activityKey}
            config={configRef.current as any}
            onComplete={handleLearningComplete}
            autoStartTier="learn"
          />
        )}
      </LearningOverlayShell>
    </div>
  );
}