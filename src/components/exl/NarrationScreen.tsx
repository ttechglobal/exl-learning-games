"use client";

import { useState, useEffect, useRef } from "react";
import type { MissionRow } from "@/types/db";
import { resolveMissionBriefing } from "@/lib/content/missionBriefing";
import styles from "./NarrationScreen.module.css";
import { CHARACTERS, FALLBACK_CHARACTER, SceneBackground, CharacterFigure } from "./NarrationScene";


// ─── Briefing lines ──────────────────────────────────────────────────────────

function splitIntoLines(text: string): string[] {
  const sentences = text
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [text];
  const cards: string[] = [];
  let i = 0;
  while (i < sentences.length && cards.length < 3) {
    cards.push(sentences[i]);
    i++;
  }
  if (i < sentences.length) {
    cards.push(sentences.slice(i).join(" "));
  }
  return cards;
}

// ─── Typewriter text effect ──────────────────────────────────────────────────

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    const tick = () => {
      if (indexRef.current < text.length) {
        indexRef.current++;
        setDisplayed(text.slice(0, indexRef.current));
        timerRef.current = setTimeout(tick, 22);
      } else {
        onDone();
      }
    };

    timerRef.current = setTimeout(tick, 60);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, onDone]);

  return <span>{displayed}</span>;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface NarrationScreenProps {
  gameSlug: string;
  subject: string;
  mission: MissionRow;
  onStart: () => void;
  /** Back navigation — provided by PlayClient, renders a game-styled back
   *  button inside the scene area (top-left) so NarrationScreen stays
   *  self-contained and doesn't need PrePlayShell's header row. */
  onBack?: () => void;
  backLabel?: string;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NarrationScreen({ gameSlug, subject, mission, onStart, onBack }: NarrationScreenProps) {
  const character = CHARACTERS[subject] ?? FALLBACK_CHARACTER;

  const briefingText = resolveMissionBriefing(gameSlug);
  const [baseLines] = useState<string[]>(() => {
    const parsed = splitIntoLines(briefingText);
    return [
      ...parsed,
      mission.learning_goal
        ? `Your goal: ${mission.learning_goal}. Ready to begin?`
        : "Ready to begin?",
    ];
  });

  const [lineIndex, setLineIndex] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const currentLine = baseLines[lineIndex];
  const isLast = lineIndex === baseLines.length - 1;

  function handleNext() {
    if (!typingDone) {
      setTypingDone(true);
      return;
    }
    if (isLast) {
      onStart();
      return;
    }
    setIsAnimatingOut(true);
    setTimeout(() => {
      setLineIndex(i => i + 1);
      setTypingDone(false);
      setIsAnimatingOut(false);
    }, 160);
  }

  return (
    <div className={styles.screen}>

      {/* ── SCENE (character + background) ── */}
      <div className={styles.scene}>
        <SceneBackground subject={subject} />

        {/* Back button — rendered inside the scene so it sits on the dark
            background and doesn't need PrePlayShell's header row */}
        {onBack && (
          <button
            className={styles.backBtn}
            onClick={onBack}
            aria-label="Go back"
          >
            ←
          </button>
        )}

        <div className={styles.characterWrap} aria-hidden="true">
          <CharacterFigure subject={subject} />
        </div>

        <div className={styles.nameBadge}>
          <span className={styles.nameBadgeName}>{character.name}</span>
          <span className={styles.nameBadgeRole}>{character.role}</span>
        </div>

        <div className={styles.missionChip} aria-label="Mission label">
          {mission.title}
        </div>
      </div>

      {/* ── DIALOGUE CARD ── */}
      <div className={styles.dialogueCard}>
        <div className={styles.dialogueNotch} />

        <div
          className={[
            styles.dialogueText,
            isAnimatingOut ? styles.dialogueFadeOut : styles.dialogueFadeIn,
          ].join(" ")}
        >
          {!isAnimatingOut && (
            <TypewriterText
              key={currentLine}
              text={currentLine}
              onDone={() => setTypingDone(true)}
            />
          )}
        </div>

        <div className={styles.dialogueFooter}>
          <div className={styles.dots} role="status" aria-label={`Line ${lineIndex + 1} of ${baseLines.length}`}>
            {baseLines.map((_, i) => (
              <div
                key={i}
                className={[styles.dot, i === lineIndex ? styles.dotActive : ""].join(" ")}
              />
            ))}
          </div>

          <button
            className={[styles.nextBtn, isLast && typingDone ? styles.nextBtnFinal : ""].join(" ")}
            onClick={handleNext}
            aria-label={isLast && typingDone ? "Begin mission" : typingDone ? "Next line" : "Skip animation"}
          >
            {isLast && typingDone ? "Begin mission" : typingDone ? "Next →" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}