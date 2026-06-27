"use client";

import { Mascot } from "@/motion/Mascot";
import type { MissionRow } from "@/types/db";

export interface LevelSelectScreenProps {
  gameTitle: string;
  missions: MissionRow[];
  onSelect: (missionId: string) => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  EASY: "#4caf6e",
  MEDIUM: "#ffb23c",
  HARD: "#ef5d4e"
};

export function LevelSelectScreen({ gameTitle, missions, onSelect }: LevelSelectScreenProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24, minHeight: "60vh", justifyContent: "center" }}>
      <div style={{ marginBottom: -14 }}>
        <Mascot pose="idle" widthPx={100} />
      </div>
      <div
        style={{
          width: "min(480px, 92vw)",
          background: "#ffffff",
          border: "3px solid #7b4fcb",
          borderRadius: 22,
          padding: 26,
          boxShadow: "0 10px 0 rgba(0,0,0,0.05), 0 14px 30px rgba(43,28,74,0.1)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--eg-font-display)", fontWeight: 700, fontSize: "1.3rem", color: "var(--eg-text-bright)" }}>
            {gameTitle}
          </div>
          <div style={{ fontSize: "0.84rem", color: "var(--eg-text-dim)", marginTop: 4 }}>Choose a level</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {missions.map((mission) => {
            const color = DIFFICULTY_COLOR[mission.difficulty] ?? "#7b4fcb";
            return (
              <button
                key={mission.id}
                onClick={() => onSelect(mission.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  minHeight: 60,
                  padding: "12px 18px",
                  borderRadius: 16,
                  border: `2.5px solid ${color}`,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <span>
                  <div style={{ fontFamily: "var(--eg-font-display)", fontWeight: 700, fontSize: "1rem", color: "var(--eg-text-bright)" }}>
                    {mission.title}
                  </div>
                  <div style={{ fontSize: "0.74rem", color, fontWeight: 600, marginTop: 2 }}>{mission.difficulty}</div>
                </span>
                <span style={{ fontFamily: "var(--eg-font-display)", fontWeight: 700, color: "var(--eg-gold)", fontSize: "0.86rem" }}>
                  +{mission.xp_reward} XP
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}