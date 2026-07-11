"use client";
/**
 * QuickPlayModal.tsx
 *
 * Bottom-sheet modal — player taps "▶ Play" on a game card in the
 * Worlds dashboard, picks a difficulty, and launches directly.
 *
 * Place at: src/components/ui/QuickPlayModal.tsx
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { subjectMeta } from "@/lib/content/subjects";
import { GameCardArt } from "@/components/ui/GameCardArt";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import type { GameRow } from "@/types/db";
import styles from "./QuickModal.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuickPlayModalProps {
  game: GameRow | null;
  onClose: () => void;
}

type DifficultyChoice = "easy" | "medium" | "hard";

const DIFFICULTY_OPTIONS: { value: DifficultyChoice; label: string; icon: string; desc: string }[] = [
  { value: "easy",   label: "Easy",   icon: "🌱", desc: "Guided, step-by-step" },
  { value: "medium", label: "Medium", icon: "⚡", desc: "Standard challenge"   },
  { value: "hard",   label: "Hard",   icon: "🔥", desc: "Exam-ready pressure"  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickPlayModal({ game, onClose }: QuickPlayModalProps) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<DifficultyChoice>("medium");
  const [visible, setVisible] = useState(false);

  // Animate in / out
  useEffect(() => {
    if (game) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [game]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handlePlay() {
    if (!game) return;
    setVisible(false);
    setTimeout(() => {
      router.push(`/play/${game.slug}?difficulty=${difficulty}`);
    }, 200);
  }

  function handleDetails() {
    if (!game) return;
    setVisible(false);
    setTimeout(() => {
      router.push(`/play/${game.slug}`);
    }, 200);
  }

  if (!game) return null;

  // Use subjectMeta as a function (not an object index)
  const m = subjectMeta(game.subject);
  // GAME_CARD_DESC[slug] is a plain string, not an object
  const cardDesc = GAME_CARD_DESC[game.slug] ?? null;

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropVisible : ""}`}
      onPointerDown={handleClose}
    >
      <div
        className={`${styles.sheet} ${visible ? styles.sheetVisible : ""}`}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className={styles.dragHandle} />

        {/* Game art + identity */}
        <div className={styles.header}>
          <div className={styles.artWrap}>
            {/* GameCardArt takes gameSlug, emoji, color, tint — not "slug" or "size" */}
            <GameCardArt
              gameSlug={game.slug}
              emoji={m.emoji}
              color={m.color}
              tint={m.tint}
            />
          </div>
          <div className={styles.identity}>
            <div
              className={styles.subjectBadge}
              style={{ background: m.tint, color: m.color, borderColor: m.color + "44" }}
            >
              {m.emoji} {m.name}
            </div>
            {/* GameRow uses .title, not .name */}
            <div className={styles.gameTitle}>{game.title}</div>
            {cardDesc && <div className={styles.gameTagline}>{cardDesc}</div>}
          </div>
        </div>

        {/* Topic chip */}
        {game.topic_id && (
          <div className={styles.topicRow}>
            <span className={styles.topicChip}>
              {game.topic_id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        )}

        {/* Difficulty picker */}
        <div className={styles.diffSection}>
          <div className={styles.diffLabel}>Choose difficulty</div>
          <div className={styles.diffRow}>
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`${styles.diffBtn} ${difficulty === opt.value ? styles.diffBtnActive : ""}`}
                onClick={() => setDifficulty(opt.value)}
              >
                <span className={styles.diffIcon}>{opt.icon}</span>
                <span className={styles.diffName}>{opt.label}</span>
                <span className={styles.diffDesc}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.playBtn} onClick={handlePlay}>
            ▶ Play Now
          </button>
          <button className={styles.detailsBtn} onClick={handleDetails}>
            View Game Page
          </button>
        </div>
      </div>
    </div>
  );
}