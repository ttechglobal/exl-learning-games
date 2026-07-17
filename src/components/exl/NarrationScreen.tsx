"use client";

/**
 * NarrationScreen.tsx — v2
 *
 * Mission briefing via character dialogue. Renders inside EXLShell.
 * Replaces EntryScreen in PlayClient.tsx.
 * ConceptSnapshot removed from the flow — guided engine teaches in-play.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { EXLShell } from "@/components/exl/EXLShell";
import { resolveMissionBriefing } from "@/lib/content/missionBriefing";
import type { MissionRow } from "@/types/db";
import styles from "./NarrationScreen.module.css";

function BackCircle({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className={styles.backCircle} onClick={onClick} aria-label={label}>
      ←
    </button>
  );
}

function MissionChip({ title }: { title: string }) {
  return <div className={styles.missionChip}>{title}</div>;
}

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
        timerRef.current = setTimeout(tick, 20);
      } else {
        onDone();
      }
    };
    timerRef.current = setTimeout(tick, 80);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, onDone]);

  return <span>{displayed}</span>;
}

function splitBriefing(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length <= 1) return [text];
  const cards: string[] = [];
  let i = 0;
  while (i < sentences.length && cards.length < 3) {
    if (i + 1 < sentences.length && sentences[i].length < 60) {
      cards.push(sentences[i] + " " + sentences[i + 1]);
      i += 2;
    } else {
      cards.push(sentences[i]);
      i++;
    }
  }
  if (i < sentences.length) cards[cards.length - 1] += " " + sentences.slice(i).join(" ");
  return cards;
}

export interface NarrationScreenProps {
  gameSlug: string;
  subject: string;
  mission: MissionRow;
  onStart: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function NarrationScreen({ gameSlug, subject, mission, onStart, onBack, backLabel = "Back" }: NarrationScreenProps) {
  const briefing = resolveMissionBriefing(gameSlug);
  const [lines] = useState<string[]>(() => {
    const parsed = splitBriefing(briefing);
    const goal = mission.learning_goal ? `Your goal: ${mission.learning_goal}. Ready?` : "Ready to begin?";
    return [...parsed, goal];
  });
  const [lineIndex, setLineIndex] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [fading, setFading] = useState(false);
  const isLast = lineIndex === lines.length - 1;
  const handleDone = useCallback(() => setTypingDone(true), []);

  function handleNext() {
    if (!typingDone) { setTypingDone(true); return; }
    if (isLast) { onStart(); return; }
    setFading(true);
    setTimeout(() => { setLineIndex(i => i + 1); setTypingDone(false); setFading(false); }, 160);
  }

  return (
    <EXLShell
      subject={subject}
      pose="idle"
      topLeft={<BackCircle onClick={onBack} label={backLabel} />}
      topRight={<MissionChip title={mission.title} />}
    >
      <div className={[styles.text, fading ? styles.fadeOut : styles.fadeIn].join(" ")} aria-live="polite" aria-atomic="true">
        {!fading && <TypewriterText key={lines[lineIndex]} text={lines[lineIndex]} onDone={handleDone} />}
      </div>
      <div className={styles.footer}>
        <div className={styles.dots} role="status" aria-label={`Line ${lineIndex + 1} of ${lines.length}`}>
          {lines.map((_, i) => (
            <div key={i} className={[styles.dot, i === lineIndex ? styles.dotActive : ""].join(" ")} />
          ))}
        </div>
        <button className={[styles.nextBtn, isLast && typingDone ? styles.nextBtnFinal : ""].join(" ")} onClick={handleNext}>
          {isLast && typingDone ? "Begin mission →" : typingDone ? "Next →" : "Skip"}
        </button>
      </div>
    </EXLShell>
  );
}