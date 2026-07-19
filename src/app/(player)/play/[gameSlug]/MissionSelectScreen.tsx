"use client";

/**
 * MissionSelectScreen.tsx
 *
 * Mission selection as a card grid — not a list of rows.
 *
 * LAYOUT:
 *   2-column card grid on mobile, 3-column on tablet+.
 *   Each card is a self-contained tile: large mission number at top,
 *   title, learning goal snippet, stage badge, XP, and a coloured
 *   "Start" bar at the bottom — the same structure as the world game cards.
 *
 *   Completed missions: green top border + checkmark badge, still tappable.
 *   Locked missions: dimmed with lock overlay, not tappable.
 *   Next-up mission (first unlocked incomplete): accent ring + "Next" pill.
 */

import type { MissionRow } from "@/types/db";
import styles from "@/app/(player)/play/[gameSlug]/MissionSelectScreen.module.css";

export interface MissionSelectScreenProps {
  missions: MissionRow[];
  completedMissionIds: Set<string>;
  onSelect: (missionId: string) => void;
}

const STAGE: Record<string, { label: string; color: string; bg: string }> = {
  EASY:   { label: "Guided",    color: "#4caf6e", bg: "rgba(76,175,110,0.15)"  },
  MEDIUM: { label: "Practice",  color: "#ffb23c", bg: "rgba(255,178,60,0.15)"  },
  HARD:   { label: "Challenge", color: "#ef5d4e", bg: "rgba(239,93,78,0.15)"   },
};

export function MissionSelectScreen({ missions, completedMissionIds, onSelect }: MissionSelectScreenProps) {
  const completedCount = missions.filter(m => completedMissionIds.has(m.id)).length;
  const progress       = missions.length > 0 ? completedCount / missions.length : 0;

  // First mission that is unlocked but not yet completed = "next up"
  const nextUpIndex = missions.findIndex((m, i) => {
    const unlocked = i === 0 || completedMissionIds.has(missions[i - 1].id);
    return unlocked && !completedMissionIds.has(m.id);
  });

  return (
    <div className={styles.wrap}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.headerTitle}>Choose a Mission</span>
          <span className={styles.headerCount}>{completedCount} / {missions.length} complete</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* ── CARD GRID ───────────────────────────────────────────────────── */}
      <div className={styles.grid}>
        {missions.map((mission, i) => {
          const completed  = completedMissionIds.has(mission.id);
          const locked     = i > 0 && !completedMissionIds.has(missions[i - 1].id);
          const isNextUp   = i === nextUpIndex;
          const stg        = STAGE[mission.difficulty ?? "EASY"];

          return (
            <button
              key={mission.id}
              className={[
                styles.card,
                completed  ? styles.cardDone   : "",
                locked     ? styles.cardLocked : "",
                isNextUp   ? styles.cardNext   : "",
              ].filter(Boolean).join(" ")}
              onClick={() => !locked && onSelect(mission.id)}
              disabled={locked}
              aria-label={locked ? `Mission ${i + 1}: ${mission.title} — locked` : mission.title}
            >
              {/* Status overlay for locked */}
              {locked && (
                <div className={styles.lockOverlay} aria-hidden="true">
                  <span className={styles.lockIcon}>🔒</span>
                  <span className={styles.lockLabel}>Complete the previous mission to unlock</span>
                </div>
              )}

              {/* Top row: number + status badge */}
              <div className={styles.cardTop}>
                <div className={[styles.numBadge, completed ? styles.numBadgeDone : ""].filter(Boolean).join(" ")}>
                  {completed ? "✓" : i + 1}
                </div>
                <div className={styles.badges}>
                  {isNextUp && !completed && (
                    <span className={styles.nextPill}>Next up</span>
                  )}
                  {completed && (
                    <span className={styles.donePill}>Done</span>
                  )}
                </div>
              </div>

              {/* Mission title */}
              <div className={styles.cardTitle}>{mission.title}</div>

              {/* Learning goal */}
              {mission.learning_goal && (
                <div className={styles.cardGoal}>{mission.learning_goal}</div>
              )}

              {/* Spacer */}
              <div className={styles.spacer} />

              {/* Meta row */}
              <div className={styles.cardMeta}>
                <span
                  className={styles.stageBadge}
                  style={{ color: stg.color, background: stg.bg, borderColor: stg.color + "50" }}
                >
                  {stg.label}
                </span>
                {mission.xp_reward ? (
                  <span className={styles.xpBadge}>+{mission.xp_reward} XP</span>
                ) : null}
              </div>

              {/* CTA bar */}
              <div
                className={styles.cardCta}
                style={{
                  background: completed
                    ? "rgba(76,175,110,0.85)"
                    : locked
                    ? "rgba(255,255,255,0.06)"
                    : stg.color,
                }}
              >
                {completed ? "Replay" : locked ? "Locked" : "Start Mission"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
