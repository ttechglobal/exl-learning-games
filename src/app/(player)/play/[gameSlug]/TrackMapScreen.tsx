"use client";

import { useRef, useState, useEffect } from "react";
import { Mascot } from "@/motion/Mascot";
import type { MissionRow } from "@/types/db";
import styles from "@/app/(player)/play/[gameSlug]/TrackMapScreen.module.css";

export interface TrackMapScreenProps {
  gameTitle: string;
  /** Already in the order the player must progress through — see
   *  CARBON_BUILDER_MISSION_ORDER in carbonBuilderMissions.ts for how
   *  this game's missions are ordered before being passed in here. This
   *  component doesn't re-sort; it trusts the order it's given, the same
   *  way LevelSelectScreen trusts whatever order missions arrives in. */
  missions: MissionRow[];
  /** mission_id -> has at least one SUCCESSFUL attempt. See
   *  listCompletedMissionIdsForStudent — a mission with only failed
   *  attempts is not in this set and stays locked. */
  completedMissionIds: Set<string>;
  onSelect: (missionId: string) => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  EASY: "#4caf6e",
  MEDIUM: "#ffb23c",
  HARD: "#ef5d4e"
};

/**
 * app-local TrackMapScreen.tsx
 *
 * REWRITTEN from a vertical list into a horizontal, swipeable card deck
 * — see TrackMapScreen.module.css's header comment for the technical
 * approach (native CSS scroll-snap, no new dependency).
 *
 * NEW screen, distinct from LevelSelectScreen — see PlayClient.tsx's
 * header comment for the full reasoning. LevelSelectScreen is a flat,
 * unordered, always-fully-unlocked grid (right for Atom Forge's
 * genuinely separate levels); this is an ORDERED, LOCKED path, for games
 * like Carbon Builder where mission N+1 only makes sense after N's
 * concept has actually been practiced.
 *
 * Lock rule: mission index 0 is always unlocked. Mission index i>0 is
 * unlocked iff missions[i-1].id is in completedMissionIds — i.e.
 * unlocking is purely sequential on the PREVIOUS step, not "any prior
 * step." A student can't skip mission 3 by completing mission 5 some
 * other way; this matches "must complete a mission before the next one
 * unlocks" literally, one step at a time, not "any earlier completion
 * counts."
 *
 * NOTE on a boundary case this deliberately does NOT guard against: the
 * check is "is i-1 completed," not "is the full prefix 0..i-1 all
 * completed." Under every normal play path these are equivalent — a
 * student can only produce a successful attempt for mission i by having
 * played it, which requires it to have been unlocked, which requires
 * i-1 already completed — so completedMissionIds is always a true
 * prefix of the mission list in practice ({m0}, {m0,m1}, ..., never a
 * set with a gap). A gap (e.g. m2 completed but m0/m1 not) is only
 * reachable via direct data manipulation outside this UI; if it ever
 * happened, mission i=3 would incorrectly show unlocked off the back of
 * m2 alone. Not worth defending against here (it would mean a full-
 * prefix scan for a case normal play can't produce), but flagged
 * explicitly so a future reader doesn't mistake this for an oversight.
 *
 * Visual states (three, not two): completed (checkmark, still tappable
 * for replay — finishing a mission shouldn't make it inaccessible),
 * unlocked-not-yet-completed (tappable, normal difficulty-colored
 * border), locked (dimmed but VISIBLE per direct decision — the player
 * can see the whole path by swiping through before earning access to
 * later steps — 🔒 badge, not tappable).
 */
export function TrackMapScreen({ gameTitle, missions, completedMissionIds, onSelect }: TrackMapScreenProps) {
  const deckRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Tracks which card is currently most-centered in the scroll-snap deck,
  // purely to drive the dot indicator below — IntersectionObserver
  // (rather than a scroll-position calculation) since scroll-snap
  // already guarantees a card lands centered, so "which card is most
  // visible" is exactly what an observer with a center-weighted
  // rootMargin answers natively, without re-deriving snap-point math by
  // hand.
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce((best, entry) => (entry.intersectionRatio > (best?.intersectionRatio ?? 0) ? entry : best), entries[0]);
        if (mostVisible?.target) {
          const idx = Number((mostVisible.target as HTMLElement).dataset.cardIndex);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
        }
      },
      { root: deck, threshold: [0.5, 0.75, 1] }
    );

    const cards = deck.querySelectorAll("[data-card-index]");
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [missions.length]);

  return (
    <div className={styles.wrap}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={100} />
      </div>

      <div className={styles.heading}>
        <div className={styles.gameTitle}>{gameTitle}</div>
        <div className={styles.subheading}>Swipe to see every step — complete each one to unlock the next</div>
      </div>

      <div className={styles.deck} ref={deckRef}>
        {missions.map((mission, i) => {
          const isCompleted = completedMissionIds.has(mission.id);
          const isUnlocked = i === 0 || completedMissionIds.has(missions[i - 1].id);
          const color = DIFFICULTY_COLOR[mission.difficulty] ?? "#7b4fcb";

          return (
            <div key={mission.id} className={styles.cardSlot} data-card-index={i}>
              {isUnlocked ? (
                <button
                  className={styles.card}
                  style={{ "--card-color": color, "--card-bg": isCompleted ? "rgba(76,175,110,0.07)" : "#fff" } as React.CSSProperties}
                  onClick={() => onSelect(mission.id)}
                >
                  <div className={styles.cardArtWrap}>
                    <MoleculeIcon payload={mission.payload} />
                  </div>
                  <div className={styles.cardTitle}>
                    {isCompleted ? "✓ " : ""}
                    {mission.title}
                  </div>
                  <div className={styles.cardMetaRow}>
                    <span className={styles.cardDifficulty}>{mission.difficulty}</span>
                    <span className={styles.cardXp}>+{mission.xp_reward} XP</span>
                  </div>
                </button>
              ) : (
                <div className={`${styles.card} ${styles.cardLocked}`} style={{ "--card-color": color } as React.CSSProperties}>
                  <div className={styles.cardArtWrap}>
                    <MoleculeIcon payload={mission.payload} />
                    <span className={styles.cardLockIcon} aria-label="Locked">
                      🔒
                    </span>
                  </div>
                  <div className={styles.cardTitle}>{mission.title}</div>
                  <div className={styles.cardLockedSubtext}>Complete the step before this to unlock</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.dots}>
        {missions.map((mission, i) => (
          <span
            key={mission.id}
            className={[styles.dot, completedMissionIds.has(mission.id) ? styles.dotCompleted : "", i === activeIndex ? styles.dotActive : ""]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Small inline SVG icon drawn directly from a mission's own payload —
 * NO image file dependency at all, per direct instruction ("the track
 * map needs an image, please make it not need an image"). Each card
 * shows the ACTUAL molecule that mission builds (ball-and-stick style,
 * matching this engine's real in-game visual language), generated from
 * real slot/bond data rather than a generic placeholder — arguably
 * better than a single static image would have been, since every card
 * in the deck looks genuinely different and accurate to its own
 * mission, not copies of one shared illustration.
 *
 * Engine-agnostic by design, matching TrackMapScreen's own scope (any
 * "trackMap" progression-mode game can use this screen, not just
 * Carbon Builder): if a mission's payload doesn't have the
 * slots/targetAtoms/targetBonds shape this expects (some other future
 * engine's payload shape), this renders nothing rather than guessing
 * at an unfamiliar shape or throwing.
 */
function MoleculeIcon({ payload }: { payload: Record<string, unknown> }) {
  const slots = payload.slots as { id: string; row: number; col: number }[] | undefined;
  const targetAtoms = payload.targetAtoms as Record<string, string> | undefined;
  const targetBonds = payload.targetBonds as { slotA: string; slotB: string; order: string }[] | undefined;

  if (!Array.isArray(slots) || !targetAtoms || !Array.isArray(targetBonds) || slots.length === 0) {
    return null;
  }

  const rows = slots.map((s) => s.row);
  const cols = slots.map((s) => s.col);
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);
  const rowSpan = Math.max(...rows) - minRow + 1;
  const colSpan = Math.max(...cols) - minCol + 1;

  const positionOf = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return { x: 0, y: 0 };
    return { x: slot.col - minCol + 0.5, y: slot.row - minRow + 0.5 };
  };

  return (
    <svg className={styles.moleculeIcon} viewBox={`0 0 ${colSpan} ${rowSpan}`} preserveAspectRatio="xMidYMid meet">
      {targetBonds.map((bond, i) => {
        const a = positionOf(bond.slotA);
        const b = positionOf(bond.slotB);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.moleculeIconBond} vectorEffect="non-scaling-stroke" />;
      })}
      {slots.map((slot) => {
        const symbol = targetAtoms[slot.id];
        if (!symbol) return null;
        const pos = positionOf(slot.id);
        const radius = symbol === "C" ? 0.22 : 0.16;
        return <circle key={slot.id} cx={pos.x} cy={pos.y} r={radius} className={styles.moleculeIconAtom} data-symbol={symbol} />;
      })}
    </svg>
  );
}
