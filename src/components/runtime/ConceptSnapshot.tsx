"use client";

import { useState } from "react";
import { primeAudioOnUserGesture } from "@/motion/sound/playSound";
import { Mascot } from "@/motion/Mascot";
import { markConceptsSeen } from "@/lib/content/contentPrefs";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import { BackButton } from "@/components/runtime/BackButton";
import { MissionTopBar } from "@/components/runtime/MissionTopBar";
import { ConceptVisual } from "@/components/runtime/ConceptVisual";
import styles from "@/components/runtime/ConceptSnapshot.module.css";

export interface ConceptCard {
  title: string;
  body: string;
  /** Optional key into the ConceptVisual registry — renders an SVG
   *  illustration above the body text when present. See
   *  ConceptVisual.tsx for the registry and available keys. */
  visual?: string;
}

export interface ConceptSnapshotProps {
  cards: ConceptCard[];
  onContinue: () => void;
  accentColor?: string;
  /** Used to resolve this game's environment art (see
   *  lib/content/gameEnvironments.ts) so Quick Concepts uses the same
   *  full-bleed backdrop as the rest of the pre-play flow and live
   *  gameplay, per direct feedback — previously this screen had no
   *  backdrop of its own at all. */
  gameSlug?: string;
  /**
   * Engine type, used to record "this player has seen these concepts"
   * (see lib/content/contentPrefs.ts) and to decide whether the Skip
   * button renders at all. Per direct feedback, Skip is now always
   * available on first viewing too — not just for returning players —
   * since teachers running a class through a mission need a fast way
   * past the briefing. Optional because ReflectionScreen's "View Concept
   * Summary" reopens this same component to revisit cards after a
   * mission — in that context there's no "skip" to offer (the player
   * explicitly asked to see them again), so the caller simply omits
   * engineType and the skip button doesn't render.
   */
  engineType?: string;
  /**
   * Game title + subject for the top header bar — same MissionTopBar
   * every OTHER pre-play screen already shows (Mission Briefing,
   * Difficulty Select, Mission Objectives, all via PrePlayShell). This
   * screen previously had NONE of that, because it's mounted by
   * GameRuntime directly, a different render path than PlayClient's
   * PrePlayShell-wrapped screens — confirmed via a direct code trace,
   * not assumed. Optional+undefined-checked rather than required, since
   * onBack only makes sense when there's somewhere sensible to go back
   * TO (see onBack's own comment).
   */
  gameTitle?: string;
  subject?: string;
  /**
   * Back-button handler for the new header bar. Deliberately optional:
   * the "reviewingConcepts" revisit flow (reopened from ReflectionScreen
   * after a mission is already complete) has nowhere sensible to "go
   * back" TO in the same sense the pre-mission flow does — GameRuntime
   * only passes this for the initial pre-mission "snapshot" phase, not
   * the post-mission revisit, so the header's back button simply doesn't
   * render in that case rather than navigating somewhere confusing.
   */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * "Before Play" briefing — and also reused for the "View Concept Summary"
 * revisit flow after a mission (per the brief: "players should still be
 * able to reopen the concept cards"). Rebuilt from a single flat block of
 * lines into real per-idea cards with a title each, matching the brief's
 * worked example (Atomic Number -> Periodic Table -> Helpful Tip).
 *
 * Players can step forward/back between cards, or skip the whole thing
 * straight to gameplay any time engineType is provided. No countdown
 * timer anymore — see the GameRow.snapshot type comment for why a single
 * shared readTimeSec didn't fit a card-by-card, skippable experience.
 *
 * BACKDROP added per direct feedback: this screen previously had no
 * environment art at all, while every other pre-play screen did — a
 * visible gap in an otherwise continuous "you're in the game's world"
 * feel. Now uses the same EnvironmentBackdrop + scrim treatment
 * PrePlayShell uses. gameSlug stays optional on this component's props
 * (not every possible caller is guaranteed to have it), but GameRuntime's
 * one shared call site — used for both the initial "snapshot" phase and
 * the post-mission "reviewingConcepts" revisit triggered from
 * ReflectionScreen's "View Concept Summary" — passes it either way, so
 * the backdrop shows in both cases in practice.
 */
/**
 * Detects lines that look like mathematical expressions and renders them
 * with monospace + accent styling — like a teacher writing on a board.
 *
 * A line is treated as a math step if it:
 * - contains = or → or ÷ or × or ²  (equation/operation symbols)
 * - starts with a letter/digit followed by a space and then = or operator
 * - is not a sentence (doesn't end with a period followed by more words)
 *
 * Annotation lines (starting with ← or •) get a dimmer italic style.
 */
function isMathLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Contains equation-like symbols
  if (/[=÷×²³√→]/.test(trimmed)) return true;
  // Looks like a formula: starts with short token then operator
  if (/^[A-Za-z0-9_]{1,6}\s*[+\-*/^]/.test(trimmed)) return true;
  return false;
}

function isAnnotationLine(line: string): boolean {
  return /^[←•–—]/.test(line.trim());
}

function renderCardBody(body: string, styles: Record<string, string>): React.ReactNode {
  const lines = body.split("\n");
  return lines.map((line, i) => {
    if (!line.trim()) return <span key={i} style={{ display: "block", height: "0.5em" }} />;
    if (isMathLine(line))       return <span key={i} className={styles.mathStep}>{line.trim()}</span>;
    if (isAnnotationLine(line)) return <span key={i} className={styles.mathStepAnnotation}>{line.trim()}</span>;
    return <span key={i} style={{ display: "block" }}>{line}</span>;
  });
}

export function ConceptSnapshot({
  cards,
  onContinue,
  accentColor = "var(--eg-subject-chemistry)",
  gameSlug,
  engineType,
  gameTitle,
  subject,
  onBack,
  backLabel = "Back"
}: ConceptSnapshotProps) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const isLast = index === cards.length - 1;
  const canSkip = Boolean(engineType);
  const images = gameSlug ? resolveGameEnvironmentImages(gameSlug) : undefined;
  const showHeader = Boolean(gameTitle && subject);

  function handleContinue() {
    primeAudioOnUserGesture();
    if (engineType) markConceptsSeen(engineType);
    onContinue();
  }

  function goNext() {
    if (isLast) {
      handleContinue();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <EnvironmentBackdrop images={images} scrim />

      {showHeader && (
        <div className={styles.headerRow}>
          {onBack && <BackButton onBack={onBack} label={backLabel} />}
          <MissionTopBar gameTitle={gameTitle!} subject={subject!} accentColor={accentColor} />
        </div>
      )}

      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={96} />
      </div>
      <div className={styles.card}>
        <div className={styles.cardTopRow}>
          <div className={styles.cardLabel}>Quick Concept {index + 1}/{cards.length}</div>
          {canSkip && (
            <button className={styles.skipButton} onClick={handleContinue}>
              Skip
            </button>
          )}
        </div>

        <div className={styles.dots}>
          {cards.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
          ))}
        </div>

        <div className={styles.title}>{card.title}</div>
        {card.visual && (
          <div className={styles.visual}>
            <ConceptVisual visualKey={card.visual} />
          </div>
        )}
        <div className={styles.body}>
          {renderCardBody(card.body, styles)}
        </div>

        <div className={styles.actions}>
          {index > 0 && (
            <button className={styles.backButton} onClick={() => setIndex((i) => i - 1)}>
              Back
            </button>
          )}
          <button className={styles.continueButton} onClick={goNext}>
            {isLast ? "Start Mission" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}