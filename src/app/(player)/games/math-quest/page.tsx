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
 *
 * The ChangeOfSubjectEngine is shown in "learn" tier mode, auto-started
 * so the student never sees the hub/tier-selection screen.
 * We use enterTier via a wrapper that forces the engine into question mode.
 */

import { useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { MiniGolfEngine } from "@/games/math-quest/MathQuestEngine";
import type { HeartRefillResult, RoundResult } from "@/games/math-quest/MathQuestEngine";
import { ChangeOfSubjectEngine } from "@/engines/mathematics/change-of-subject/ChangeOfSubjectEngine";
import type { ChangeOfSubjectOutcome } from "@/engines/mathematics/change-of-subject/changeOfSubject.config";
import { randomMissionForTier } from "@/engines/mathematics/change-of-subject/changeOfSubjectQuestions";

// ── Build a minimal but complete config for ChangeOfSubjectEngine ─────────────
// The engine's "learn" tier needs: shared config + mission with questions.
// We pick questions from the built-in bank via randomMissionForTier.
function buildLearningConfig() {
  const qs = randomMissionForTier("learn");
  // Pick just one question for the hearts-earn activity
  const q = qs[Math.floor(Math.random() * qs.length)];
  return {
    shared: {
      pointsPerQuestion: 20,
      retryPenalty: 5,
      hintPenalty: 5,
      hintTimePenalty: 5,
      baseTimerSecs: 90,     // generous timer — this is earn-hearts mode
      retryTimerCut: 10,
      minTimerSecs: 30,
      practiceTimerFromQ: 99, // never start timer in earn-hearts mode
    },
    mission: {
      id: `golf-hearts-${Date.now()}`,
      missionKey: "cos-learn-m1",
      title: "Earn Hearts — Change of Subject",
      xpReward: 15,
      topicId: "change-of-subject",
      subtopicId: undefined,
      payload: { questions: [q] },
    },
  };
}

// ── LearningOverlayShell ──────────────────────────────────────────────────────
// Glass card that sits on top of the blurred golf canvas.
// The student can always see the golf world behind them.
// They can escape with the "Back to Golf" button (costs the hearts).
interface LearningOverlayShellProps {
  visible: boolean;
  onSkip: () => void;       // student bails out — give 0 hearts
  children: React.ReactNode;
}
function LearningOverlayShell({ visible, onSkip, children }: LearningOverlayShellProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 90,
      // Blur + dim the golf canvas behind — student can still see they're in golf
      backdropFilter: "blur(6px) brightness(0.55) saturate(0.7)",
      WebkitBackdropFilter: "blur(6px) brightness(0.55) saturate(0.7)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "12px",
      animation: "overlayIn .28s cubic-bezier(.2,1,.4,1) both",
    }}>
      {/* Glass card */}
      <div style={{
        background: "#fff",
        borderRadius: 24,
        width: "100%", maxWidth: 460,
        maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.3)",
        overflow: "hidden",
        animation: "cardUp .32s cubic-bezier(.2,1,.4,1) both",
      }}>
        {/* Header strip */}
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
              Out of Hearts — Solve to Continue
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>
              Complete the activity to earn 3 hearts ❤️❤️❤️
            </div>
          </div>
          {/* Escape button — always visible */}
          <button onClick={onSkip} style={{
            background: "rgba(255,255,255,.15)", border: "1.5px solid rgba(255,255,255,.3)",
            borderRadius: 100, color: "#fff", fontSize: 12, fontWeight: 700,
            padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap",
            fontFamily: "inherit",
          }}>
            Skip ✕
          </button>
        </div>

        {/* Learning engine content — scrollable */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {children}
        </div>

        {/* Footer — context + escape */}
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid #eee",
          background: "#fafaf8",
          flexShrink: 0,
        }}>
          <button onClick={onSkip} style={{
            width: "100%", padding: "10px 16px",
            borderRadius: 100, border: "1.5px solid #d4e0d0",
            background: "#f0f6ee", color: "#3A6A30",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}>
            ⛳ Back to Golf (skip — hearts not restored)
          </button>
        </div>
      </div>

      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cardUp {
          from { transform: translateY(32px) scale(.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── HeartEarnActivity ─────────────────────────────────────────────────────────
// Mounts ChangeOfSubjectEngine with a fresh config each time.
// Keyed by a changing value so it fully remounts each time it's shown.
interface HeartEarnActivityProps {
  onComplete: (outcome: ChangeOfSubjectOutcome) => void;
}
function HeartEarnActivity({ onComplete }: HeartEarnActivityProps) {
  // Build config once when this component mounts
  const configRef = useRef(buildLearningConfig());
  return (
    <ChangeOfSubjectEngine
      config={configRef.current as any}
      onComplete={onComplete}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MathQuestGolfPage() {
  const router = useRouter();

  const [showLearning, setShowLearning]     = useState(false);
  const [activityKey, setActivityKey]       = useState(0); // forces remount for fresh config
  const resolveRef = useRef<((r: HeartRefillResult) => void) | null>(null);

  const handleNeedHearts = useCallback((resolve: (r: HeartRefillResult) => void) => {
    resolveRef.current = resolve;
    setActivityKey(k => k + 1); // new key = fresh ChangeOfSubjectEngine instance
    setShowLearning(true);
  }, []);

  const handleLearningComplete = useCallback((outcome: ChangeOfSubjectOutcome) => {
    setShowLearning(false);
    // Give 3 hearts back on successful completion
    resolveRef.current?.({
      heartsGranted: 3,
      xpEarned: outcome.xpEarned ?? 15,
    });
    resolveRef.current = null;
  }, []);

  const handleSkip = useCallback(() => {
    setShowLearning(false);
    // Student bailed — give 0 hearts (they stay stuck but can try again)
    resolveRef.current?.({ heartsGranted: 0, xpEarned: 0 });
    resolveRef.current = null;
  }, []);

  const handleRoundEnd = useCallback((_result: RoundResult) => {
    // TODO: POST _result to /api/attempts
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* Golf engine — always rendered and running */}
      <MiniGolfEngine
        onNeedHearts={handleNeedHearts}
        onRoundEnd={handleRoundEnd}
        onExit={() => router.push("/worlds")}
        heartsPerHole={3}
      />

      {/* Learning overlay — glass card on top of blurred golf */}
      <LearningOverlayShell
        visible={showLearning}
        onSkip={handleSkip}
      >
        {showLearning && (
          <HeartEarnActivity
            key={activityKey}
            onComplete={handleLearningComplete}
          />
        )}
      </LearningOverlayShell>
    </div>
  );
}