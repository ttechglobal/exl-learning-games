"use client";

import { useState } from "react";
import { getGameTheme } from "@/lib/content/gameThemes";
import styles from "@/components/ui/GameCardArt.module.css";

export interface GameCardArtProps {
  gameSlug: string;
  /** Subject emoji — shown when no card art exists */
  emoji: string;
  /** Subject accent colour — fallback only when game has no theme entry */
  color: string;
  tint: string;
}

/**
 * Renders a game's card art SVG.
 *
 * Priority:
 *   1. Game-specific card SVG (cardArt field in gameThemes.ts)
 *   2. Fallback: subject emoji on the GAME'S own world gradient
 *      — not a generic grey box, not the subject colour.
 *      Every game gets its own colour even without card art.
 */
export function GameCardArt({ gameSlug, emoji, color, tint }: GameCardArtProps) {
  const theme = getGameTheme(gameSlug);
  const src = theme.cardArt;
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  // Fallback uses the game's own accent as the base colour
  const fallbackColor = theme.accent !== "var(--eg-brand)" ? theme.accent : color;

  return (
    <div
      className={styles.art}
      style={{
        "--c": fallbackColor,
        "--c-tint": tint,
        // When no card art: show the game's world gradient
        background: showImage
          ? undefined
          : theme.preGameGradient,
      } as React.CSSProperties}
    >
      {!showImage && (
        <div className={styles.fallback}>
          <span className={styles.fallbackEmoji}>{emoji}</span>
        </div>
      )}
      {showImage && (
        <img
          className={styles.img}
          src={src}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
