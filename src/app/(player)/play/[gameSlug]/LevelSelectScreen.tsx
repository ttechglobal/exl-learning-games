// FILE: src/app/(player)/play/[gameSlug]/LevelSelectScreen.tsx
"use client";

import type { MissionRow } from "@/types/db";

export interface LevelSelectScreenProps {
  gameTitle: string;
  subject?: string;
  studentName?: string;
  coach?: string;
  missions: MissionRow[];
  onSelect: (missionId: string) => void;
}

const DIFFICULTY_META: Record<string, {
  label: string;
  sublabel: string;
  colour: string;
  bg: string;
  icon: string;
}> = {
  EASY: {
    label: "Guided Learning",
    sublabel: "Learn the concept step by step",
    colour: "#0284c7",
    bg: "rgba(2,132,199,0.08)",
    icon: "🧑‍🔬",
  },
  MEDIUM: {
    label: "Practice",
    sublabel: "Apply what you've learned",
    colour: "#7c3aed",
    bg: "rgba(124,58,237,0.08)",
    icon: "✏️",
  },
  HARD: {
    label: "Challenge",
    sublabel: "Push your understanding further",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.07)",
    icon: "⚡",
  },
  MASTERY: {
    label: "Mastery",
    sublabel: "Exam-style questions — no hints",
    colour: "#f59e0b",
    bg: "rgba(245,158,11,0.07)",
    icon: "🏆",
  },
};

const SUBJECT_GRADIENT: Record<string, string> = {
  chemistry:   "linear-gradient(160deg, #0c2d48 0%, #0a1628 100%)",
  physics:     "linear-gradient(160deg, #1a0533 0%, #0d0820 100%)",
  mathematics: "linear-gradient(160deg, #062318 0%, #041810 100%)",
  biology:     "linear-gradient(160deg, #1a1000 0%, #0f0900 100%)",
};

const SUBJECT_ACCENT: Record<string, string> = {
  chemistry:   "#0284c7",
  physics:     "#7c3aed",
  mathematics: "#059669",
  biology:     "#b45309",
};

const COACH_GREETINGS = [
  "Ready to learn something new today?",
  "Let's dive in — pick where you want to start.",
  "Good to see you! Choose your level below.",
  "Let's make this click. Where do you want to start?",
];

export function LevelSelectScreen({
  gameTitle,
  subject = "chemistry",
  studentName,
  coach,
  missions,
  onSelect,
}: LevelSelectScreenProps) {
  const bg     = SUBJECT_GRADIENT[subject] ?? SUBJECT_GRADIENT.chemistry;
  const accent = SUBJECT_ACCENT[subject]   ?? "#0284c7";
  const coachName = coach ?? (
    subject === "physics" ? "Prof. Emeka" :
    subject === "mathematics" ? "Ms. Chidera" : "Dr. Adaobi"
  );

  const greeting = COACH_GREETINGS[Math.floor(gameTitle.length % COACH_GREETINGS.length)];
  const firstName = studentName?.split(" ")[0];

  // Group missions by difficulty — show one card per stage, not one per mission
  const ORDER = ["EASY", "MEDIUM", "HARD", "MASTERY"] as const;
  type Diff = typeof ORDER[number];

  const grouped: Record<Diff, typeof missions> = { EASY: [], MEDIUM: [], HARD: [], MASTERY: [] };
  missions.forEach(m => {
    const d = m.difficulty as Diff;
    if (grouped[d]) grouped[d].push(m);
  });

  // One entry per difficulty that has at least one mission
  const stages = ORDER.filter(d => grouped[d].length > 0).map(d => ({
    difficulty: d,
    missions: grouped[d],
    firstMissionId: grouped[d].sort((a, b) => a.sequence_index - b.sequence_index)[0].id,
    totalXp: grouped[d].reduce((s, m) => s + (m.xp_reward ?? 0), 0),
    count: grouped[d].length,
  }));

  return (
    <div style={{
      background: bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      padding: "0 0 32px",
    }}>

      {/* Top — topic label */}
      <div style={{ padding: "20px 22px 0" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: `${accent}99`, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
          {subject.charAt(0).toUpperCase() + subject.slice(1)}
        </div>
        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
          {gameTitle}
        </div>
      </div>

      {/* Coach greeting */}
      <div style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
            background: `${accent}22`, border: `2px solid ${accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🧑‍🔬</div>
          <div style={{
            background: "rgba(255,255,255,0.07)",
            border: `1px solid ${accent}30`,
            borderRadius: "4px 14px 14px 14px",
            padding: "12px 16px", flex: 1,
          }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: accent, marginBottom: 5 }}>
              {coachName}
            </div>
            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {firstName ? `Hey ${firstName}! ` : "Hey! "}{greeting}
            </div>
          </div>
        </div>
      </div>

      {/* Level cards */}
      <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
          Choose your level
        </div>

        {stages.map((stage) => {
          const meta = DIFFICULTY_META[stage.difficulty] ?? {
            label: stage.difficulty,
            sublabel: "",
            colour: accent,
            bg: `${accent}10`,
            icon: "▶",
          };

          return (
            <button
              key={stage.difficulty}
              onClick={() => onSelect(stage.firstMissionId)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                borderRadius: 14,
                border: `1.5px solid ${meta.colour}35`,
                background: meta.bg,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                width: "100%",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${meta.colour}18`,
                border: `1.5px solid ${meta.colour}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.3rem",
              }}>
                {meta.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: 3 }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                  {meta.sublabel}
                  {stage.count > 1 && ` · ${stage.count} questions`}
                </div>
              </div>

              {stage.totalXp > 0 && (
                <div style={{
                  fontSize: "0.72rem", fontWeight: 800,
                  color: "#f59e0b", flexShrink: 0,
                  background: "rgba(245,158,11,0.1)",
                  padding: "3px 8px", borderRadius: 8,
                }}>
                  +{stage.totalXp} XP
                </div>
              )}

              <div style={{ color: `${meta.colour}80`, fontSize: "1rem", flexShrink: 0 }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}