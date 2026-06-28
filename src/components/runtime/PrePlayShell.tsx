"use client";

import { BackButton } from "@/components/runtime/BackButton";
import { MissionTopBar } from "@/components/runtime/MissionTopBar";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import styles from "@/components/runtime/PrePlayShell.module.css";

export interface PrePlayShellProps {
  gameSlug: string;
  gameTitle: string;
  subject: string;
  accentColor?: string;
  onBack: () => void;
  backLabel: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper for the ENTIRE pre-gameplay flow (Level Select, Mission
 * Briefing, Difficulty Select, Mission Objectives) — replaces each of
 * those screens rendering BackButton/MissionTopBar/its own backdrop as
 * independent siblings (the old PlayClient.tsx pattern). That structure
 * is exactly what caused two separate, confirmed problems:
 *
 * 1. "THE TOP BAR IS A DIFFERENT COLOR" — BackButton and MissionTopBar
 *    used to render outside any backdrop-having container, so they sat
 *    on the page's plain base background while the screen content below
 *    them (EntryScreen's own .wrap, etc.) had its own separately-applied
 *    backdrop image. The seam between "top bar area" and "the rest of
 *    the screen" was a real, visible boundary. Now the backdrop lives on
 *    THIS component, and BackButton/MissionTopBar render INSIDE it as
 *    children alongside the screen content — one continuous background
 *    behind everything, full height, nothing carved out for the header.
 *
 * 2. DUPLICATED BACKDROP LOGIC — EntryScreen, DifficultySelectScreen, and
 *    MissionObjectivesScreen each independently grew their own
 *    image+scrim markup and CSS (three near-identical copies). All of
 *    that is deleted from those files now; EnvironmentBackdrop here is
 *    the only place it exists.
 *
 * MOBILE HEIGHT, NOT WIDTH — per direct feedback: on mobile this stretches
 * vertically to fill the viewport (min-height: 100vh, content allowed to
 * use that full height rather than clustering at the top with empty
 * space below) while staying width-constrained — same single-column feel
 * on a phone regardless of content length. Desktop is free to use width
 * (see the >=1024px rule capping content at a comfortable reading column
 * instead, the same number GameplayShell already uses for the gameplay
 * frame, so the pre-play flow and actual gameplay share one consistent
 * "how wide is too wide" answer).
 */
export function PrePlayShell({ gameSlug, gameTitle, subject, accentColor, onBack, backLabel, children }: PrePlayShellProps) {
  const images = resolveGameEnvironmentImages(gameSlug);

  return (
    <div className={styles.shell} style={accentColor ? ({ "--accent-color": accentColor } as React.CSSProperties) : undefined}>
      <EnvironmentBackdrop images={images} fallbackSrc="/mascot/scene-backdrop.svg" scrim />

      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <BackButton onBack={onBack} label={backLabel} />
          <MissionTopBar gameTitle={gameTitle} subject={subject} accentColor={accentColor} />
        </div>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
