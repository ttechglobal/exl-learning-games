"use client";

import { BackButton } from "@/components/runtime/BackButton";
import { MissionTopBar } from "@/components/runtime/MissionTopBar";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages, resolveGameThemeGradient } from "@/lib/content/gameEnvironments";
import { getGameTheme } from "@/lib/content/gameThemes";
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

export function PrePlayShell({
  gameSlug,
  gameTitle,
  subject,
  accentColor,
  onBack,
  backLabel,
  children,
}: PrePlayShellProps) {
  const images = resolveGameEnvironmentImages(gameSlug);
  const themeGradient = resolveGameThemeGradient(gameSlug)
    || getGameTheme(gameSlug, subject).preGameGradient;

  return (
    <div
      className={styles.shell}
      style={{
        "--theme-gradient": themeGradient,
        ...(accentColor ? { "--accent-color": accentColor } : {}),
      } as React.CSSProperties}
    >
      <EnvironmentBackdrop
        images={images}
        fallbackSrc="/illustrations/generic-fallback.png"
        scrim
      />

      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <BackButton onBack={onBack} label={backLabel} />
          <MissionTopBar
            gameTitle={gameTitle}
            subject={subject}
            accentColor={accentColor}
          />
        </div>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}