// FILE: src/app/(player)/play/[gameSlug]/LevelSelectScreen.tsx
"use client";


import type { MissionRow } from "@/types/db";

export interface LevelSelectScreenProps {
  gameTitle: string;
  subject?: string;
  studentName?: string;
  coach?: string;
  missions: MissionRow[];
  completedMissionIds?: Set<string>;
  onSelect: (missionId: string) => void;
  onBack?: () => void;
}

const SUBJECT_META: Record<string, { gradient: string; accent: string; coachIcon: string; coachName: string }> = {
  chemistry:   { gradient: "linear-gradient(160deg, #041418 0%, #061e24 50%, #083028 100%)", accent: "#00d4ff", coachIcon: "🧑‍🔬", coachName: "Dr. Adaobi" },
  physics:     { gradient: "linear-gradient(160deg, #080820 0%, #0c1040 50%, #0a0c30 100%)", accent: "#4488ff", coachIcon: "🧑‍🔬", coachName: "Prof. Emeka" },
  mathematics: { gradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)", accent: "#c9a227", coachIcon: "🧑‍🏫", coachName: "Ms. Chidera" },
  biology:     { gradient: "linear-gradient(160deg, #081a06 0%, #0f2a08 50%, #0a2006 100%)", accent: "#7ecf3e", coachIcon: "🧑‍🔬", coachName: "Dr. Adaobi" },
};

const STAGE_META: Record<string, { label: string; sublabel: string; icon: string; colour: string }> = {
  EASY:   { label: "Guided Learning",  sublabel: "Learn the concept step by step", icon: "🧑‍🔬", colour: "#00d4ff" },
  MEDIUM: { label: "Practice",         sublabel: "Apply what you've learned",       icon: "✏️",   colour: "#7c3aed" },
  HARD:   { label: "Challenge",        sublabel: "Push your understanding further", icon: "⚡",   colour: "#ef4444" },
  MASTERY:{ label: "Mastery",          sublabel: "Exam-style — no hints",           icon: "🏆",   colour: "#f59e0b" },
};

const ORDER = ["EASY", "MEDIUM", "HARD", "MASTERY"];

const GREETINGS = [
  "Ready to learn something new today?",
  "Let's dive in — pick where you want to start.",
  "Good to see you! Choose your level below.",
  "Let's make this click. Where do you want to start?",
];

export function LevelSelectScreen({
  gameTitle, subject = "chemistry", studentName, coach, missions,
  completedMissionIds, onSelect, onBack,
}: LevelSelectScreenProps) {
  // No expand state needed — Guided Learning shows next concept inline always

  const meta = SUBJECT_META[subject] ?? SUBJECT_META.chemistry;
  const isMaths = subject === "mathematics";
  const coachName = coach ?? meta.coachName;
  const firstName = studentName?.split(" ")[0];

  // Topic-aware coach greeting — declared before use
  const topicGreeting = `Today we're exploring ${gameTitle}. ${firstName ? `Let's go, ${firstName}!` : "Let's go!"}`;
  const greeting = topicGreeting;

  // Group missions by difficulty
  const grouped: Record<string, MissionRow[]> = {};
  missions.forEach(m => {
    const d = m.difficulty;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.sequence_index - b.sequence_index));

  const stages = ORDER.filter(d => grouped[d]?.length > 0);

  // Find first incomplete mission per stage (for resume)
  const firstIncomplete = (missionList: MissionRow[]) => {
    const next = missionList.find(m => !completedMissionIds?.has(m.id));
    return next ?? missionList[missionList.length - 1];
  };

  const textMain  = isMaths ? "#1a0a00" : "#ffffff";
  const textDim   = isMaths ? "rgba(90,64,16,0.7)" : "rgba(255,255,255,0.5)";
  const cardBg    = isMaths ? "rgba(255,253,240,0.9)" : "rgba(6,14,26,0.75)";
  const cardBorder= isMaths ? "rgba(201,162,39,0.3)" : "rgba(255,255,255,0.08)";

  return (
    <div style={{ background: meta.gradient, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 0 40px", position: "relative" }}>

      {/* Back button — absolute top-left, doesn't affect header layout */}
      {onBack && (
        <button onClick={onBack} style={{
          position: "absolute", top: 16, left: 16, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${meta.accent}40`,
          background: `${meta.accent}15`, color: meta.accent,
          fontSize: "1rem", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>←</button>
      )}

      {/* Header — centred, with back button floating above */}
      <div style={{ padding: "20px 20px 0", textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: `${meta.accent}bb`, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
          {subject.charAt(0).toUpperCase() + subject.slice(1)}
        </div>
        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: textMain, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
          {gameTitle}
        </div>
      </div>

      {/* Coach greeting */}
      <div style={{ padding: "22px 20px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: `${meta.accent}20`, border: `2px solid ${meta.accent}60`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>{meta.coachIcon}</div>
          <div style={{
            background: isMaths ? "rgba(255,253,240,0.9)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${meta.accent}30`,
            borderRadius: "4px 14px 14px 14px",
            padding: "10px 14px", flex: 1,
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: meta.accent, marginBottom: 4 }}>{coachName}</div>
            <div style={{ fontSize: "0.88rem", color: textMain, lineHeight: 1.5 }}>
              {firstName ? `Hey ${firstName}! ` : "Hey! "}{greeting}
            </div>
          </div>
        </div>
      </div>

      {/* Stage cards */}
      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
          Choose your level
        </div>

        {stages.map(difficulty => {
          const stageMeta = STAGE_META[difficulty] ?? { label: difficulty, sublabel: "", icon: "▶", colour: meta.accent };
          const stageMissions = grouped[difficulty] ?? [];
          const totalXp = stageMissions.reduce((s, m) => s + (m.xp_reward ?? 0), 0);
          const isGL = difficulty === "EASY";
          const completedCount = stageMissions.filter(m => completedMissionIds?.has(m.id)).length;
          const progressPct = stageMissions.length > 0 ? (completedCount / stageMissions.length) * 100 : 0;
          const nextMission = firstIncomplete(stageMissions);
          const nextIndex = stageMissions.findIndex(m => m.id === nextMission.id);

          return (
            <div key={difficulty} style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* Stage header — always tappable, goes straight in */}
              <button
                onClick={() => onSelect(nextMission.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "15px 16px", width: "100%", cursor: "pointer",
                  borderRadius: isGL ? "14px 14px 0 0" : 14,
                  border: `1.5px solid ${stageMeta.colour}30`,
                  borderBottom: isGL ? "none" : `1.5px solid ${stageMeta.colour}30`,
                  background: cardBg, backdropFilter: "blur(8px)",
                  textAlign: "left", transition: "all 0.15s",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: `${stageMeta.colour}18`, border: `1.5px solid ${stageMeta.colour}35`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
                }}>{stageMeta.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: textMain, marginBottom: 2 }}>
                    {stageMeta.label}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: textDim, lineHeight: 1.4, marginBottom: completedCount > 0 ? 6 : 0 }}>
                    {stageMeta.sublabel}
                    {stageMissions.length > 1 && ` · ${stageMissions.length} ${isGL ? "concepts" : "questions"}`}
                  </div>
                  {completedCount > 0 && (
                    <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progressPct}%`, background: stageMeta.colour, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  )}
                </div>

                {totalXp > 0 && (
                  <div style={{
                    fontSize: "0.7rem", fontWeight: 800, color: "#f59e0b",
                    background: "rgba(245,158,11,0.1)", padding: "3px 8px", borderRadius: 8, flexShrink: 0,
                  }}>+{totalXp} XP</div>
                )}

                <div style={{ color: `${stageMeta.colour}70`, fontSize: "1rem", flexShrink: 0 }}>›</div>
              </button>

              {/* Guided Learning: show only the NEXT concept, always visible */}
              {isGL && (
                <button
                  onClick={() => onSelect(nextMission.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 16px 14px",
                    width: "100%", cursor: "pointer",
                    background: `${stageMeta.colour}0a`,
                    border: `1.5px solid ${stageMeta.colour}25`,
                    borderTop: `1px solid ${stageMeta.colour}18`,
                    borderRadius: "0 0 14px 14px",
                    textAlign: "left",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* Step indicator */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    background: completedCount > nextIndex
                      ? `${stageMeta.colour}35`
                      : `${stageMeta.colour}18`,
                    border: `1.5px solid ${stageMeta.colour}${completedCount > nextIndex ? "70" : "35"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 900, color: stageMeta.colour,
                  }}>
                    {completedMissionIds?.has(nextMission.id) ? "✓" : nextIndex + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* "Up next" label */}
                    <div style={{ fontSize: "0.58rem", fontWeight: 800, color: stageMeta.colour, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                      {completedMissionIds?.has(nextMission.id) ? "Replay" : completedCount === 0 ? "Start here" : "Continue"}
                    </div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: textMain, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nextMission.learning_goal ?? nextMission.title}
                    </div>
                  </div>

                  <div style={{ color: `${stageMeta.colour}80`, fontSize: "1rem", flexShrink: 0 }}>›</div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}