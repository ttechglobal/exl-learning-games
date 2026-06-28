"use client";

import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import type { GameEnvironmentImages } from "@/lib/content/gameEnvironments";
import styles from "@/components/gameplay/GameplayShell.module.css";

export interface GameplayStat {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success" | "gold";
  /** Pulses the value — used for "time running out" urgency, but generic
   *  enough for any stat that needs the same emphasis. */
  urgent?: boolean;
  /** Small secondary line under the value — tile-match's streak/tier text,
   *  optional for engines with nothing to put there. */
  caption?: string;
}

export interface GameplayShellProps {
  /** Full-page environment background, now a {desktop, mobile} pair (see
   *  lib/content/gameEnvironments.ts) rather than one single image — per
   *  direct feedback, one image cropped via object-fit either lost
   *  detail on phones or looked awkwardly zoomed on desktop. Rendered via
   *  the shared EnvironmentBackdrop component (same one PrePlayShell
   *  uses for the pre-play flow) so the picture-swap mechanism lives in
   *  exactly one place. Falls back to fallbackGradient (a CSS value, not
   *  a class) when no images are provided at all. */
  environmentImages?: GameEnvironmentImages;
  fallbackGradient: string;
  accentColor: string;
  /** Declarative HUD cards — NOT a fixed Time/Score pair. tile-match has
   *  Time + Score + streak/tier; particle-assembly has none; bond-match's
   *  level mode has only XP, factory mode adds Time. Each engine declares
   *  whatever stats it actually has; the shell only handles layout
   *  (spacing, responsive wrap, never overlapping the menu corner). */
  stats: GameplayStat[];
  /** Optional banner below the HUD — tile-match's clue text, bond-match's
   *  "Forge This Compound" + formula. Omit entirely for an engine with
   *  nothing prompt-shaped to show (e.g. particle-assembly, where the
   *  target composition is shown directly in the gameplay area instead). */
  missionPrompt?: { label: string; text: string };
  /** The in-game menu instance (see components/runtime/GameMenu.tsx) —
   *  rendered BY the shell, sharing one fixed top row with the stats
   *  cards so neither can collide with the other the way a per-engine
   *  absolute-positioned HUD + separately-fixed menu button used to
   *  (this was a real, confirmed bug: both claimed the same top-left
   *  corner). The shell owns menu + stats placement together; engines
   *  never position their own menu button or HUD again. */
  menu: React.ReactNode;
  /** True while paused — shell renders the dimmed "Paused" overlay
   *  centrally now, rather than each engine re-implementing the same
   *  overlay (tile-match previously did; bond-match/particle-assembly
   *  hadn't yet, which would have meant inconsistent pause UX per
   *  engine as more engines adopted isPaused). */
  isPaused?: boolean;
  /** The actual gameplay-specific interactive content — tile grid,
   *  bond-match's platform/dock, particle-assembly's generators. This is
   *  the ONLY part of the screen that's meant to look different from one
   *  game to the next; everything else above is shared chrome. */
  children: React.ReactNode;
}

/** Explicit map from tone -> styles.* class, not a dynamic
 *  `styles[someComputedKey]` lookup — same reasoning as the badge-class
 *  and difficulty-tier fixes elsewhere in this codebase: CSS Modules
 *  class names are hashed/typed, so building the key as a string at
 *  runtime is fragile even when the union is closed. */
const TONE_CLASS: Record<NonNullable<GameplayStat["tone"]>, string> = {
  default: "",
  danger: styles.statDanger,
  success: styles.statSuccess,
  gold: styles.statGold
};

/**
 * components/gameplay/GameplayShell.tsx
 *
 * The "master template for every game" (product brief). Owns: full-page
 * environment background, the stats/HUD row, an optional mission-prompt
 * banner, the in-game menu's fixed position, the pause overlay, and a
 * responsive content frame for whatever the engine renders inside. Every
 * engine (bond-match, particle-assembly, tile-match) now renders ONLY its
 * own gameplay-specific markup as `children`; HUD/menu/environment markup
 * that used to be duplicated (and drifting — e.g. only tile-match had a
 * pause overlay) inside each engine's own render is gone from there and
 * lives here once.
 *
 * Mobile-first responsive: menu button and stats share one row at every
 * breakpoint, both staying side by side on the LEFT at every width now —
 * per direct feedback, desktop should keep the same "menu + stats
 * grouped together" arrangement mobile uses, not a different one (an
 * earlier revision had split them to opposite ends specifically on
 * mobile per a different round of feedback; desktop staying
 * left-grouped throughout is what's being asked for now, so mobile was
 * brought back in line with it rather than introducing a third
 * arrangement). A capped max-width on large desktop keeps the gameplay
 * area from stretching into uncomfortable reading/reach distance — see
 * the brief's explicit "tablets, laptops, large desktop monitors"
 * requirement, which the old single 480px breakpoint never addressed.
 */
export function GameplayShell({
  environmentImages,
  fallbackGradient,
  accentColor,
  stats,
  missionPrompt,
  menu,
  isPaused,
  children
}: GameplayShellProps) {
  return (
    <div className={styles.shell} style={{ "--accent-color": accentColor, "--fallback-gradient": fallbackGradient } as React.CSSProperties}>
      <EnvironmentBackdrop images={environmentImages} focusLower />

      {isPaused && (
        <div className={styles.pausedOverlay}>
          <span className={styles.pausedLabel}>⏸ Paused</span>
        </div>
      )}

      {/* Menu + stats share ONE row at every breakpoint — never two
          independently-positioned elements that could land on top of
          each other (the original bug; see GameMenu.module.css's comment
          for why GameMenu's own button had to stop being position:fixed
          for that fix to actually hold). Within that shared row: on
          mobile (<600px, see CSS) menu stays top-left and stats sit at
          the opposite end, top-right, per the latest feedback; at
          >=600px they switch to grouped together on the left instead,
          where there's more room. This exact split has been asked for,
          undone, and asked for again across several rounds — see the
          CSS file's header comment for the full history before changing
          it once more. Stats are also no longer a second,
          separately-centered block beneath the menu, which is what made
          them feel as visually heavy as the actual game elements on a
          phone screen. At >=600px this same row's stats visually present
          as larger cards; the markup doesn't change between tiers, only
          the sizing/alignment does. */}
      <div className={styles.menuSlot}>
        {menu}
        <div className={styles.statsRow}>
          {stats.map((stat, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statLabel}>{stat.label}</div>
              <div className={[styles.statValue, TONE_CLASS[stat.tone ?? "default"], stat.urgent ? styles.urgent : ""].filter(Boolean).join(" ")}>
                {stat.value}
              </div>
              {stat.caption && <div className={styles.statCaption}>{stat.caption}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.topZone}>
        {missionPrompt && (
          <div className={styles.missionBanner}>
            <div className={styles.missionLabel}>{missionPrompt.label}</div>
            <div className={styles.missionText}>{missionPrompt.text}</div>
          </div>
        )}
      </div>

      <div className={styles.gameplayFrame}>{children}</div>
    </div>
  );
}