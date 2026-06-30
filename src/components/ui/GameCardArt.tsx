"use client";

import { useState } from "react";
import { GAME_CARD_ART } from "@/lib/content/gameCardMeta";
import styles from "@/components/ui/GameCardArt.module.css";

export interface GameCardArtProps {
  gameSlug: string;
  /** Subject emoji shown when there's no real art, OR when the real
   *  art exists but fails to load — see the long comment below for why
   *  this can't just be "show nothing" in that second case. */
  emoji: string;
  /** Subject accent color + tint, same values every card grid already
   *  computes for its border/badge colors — reused here so the
   *  fallback gradient matches the rest of that specific card instead
   *  of being a generic gray box. */
  color: string;
  tint: string;
}

/**
 * components/ui/GameCardArt.tsx
 *
 * Per direct feedback: "I notice the game images where not showing in
 * some devices, [...] let's have a very good fallback illustration or
 * color so irrespective of what happens... we can have something that
 * still looks very good."
 *
 * Before this component, the homepage's "Popular Games" rail rendered a
 * bare `<img src={GAME_CARD_ART[slug] ?? ""}>` with NO fallback at all —
 * a missing entry, a 404, a slow/flaky connection on a low-end device,
 * or a case-sensitive path mismatch (all real possibilities for static
 * assets on mobile) all rendered as the browser's broken-image icon
 * sitting on an otherwise-empty card. /worlds was halfway there (it
 * already swapped in an emoji when `art` was missing entirely) but had
 * no equivalent for "the path exists but the image itself failed to
 * load" — same broken-icon outcome, just for a different cause.
 *
 * THE FIX, shared in one place so both grids behave identically:
 *   1. A gradient tint (this game/subject's own accent color) is the
 *      ALWAYS-PRESENT base layer — never literally empty, never a
 *      generic gray box.
 *   2. The subject emoji sits centered on top of that gradient as the
 *      fallback illustration.
 *   3. The real <img> renders on top of BOTH of those when a path
 *      exists, and is removed from view (not just hidden visually, via
 *      React state so it stops being in the layout at all) the moment
 *      it fails to load — onError flips `failed`, which is checked
 *      BEFORE rendering the <img> at all, so a failed image can never
 *      leave a broken-icon box sitting over the gradient.
 * Net result: every single card always shows a deliberate-looking
 * illustration, whether or not real art was ever authored for that
 * game and regardless of what happens on the network.
 */
export function GameCardArt({ gameSlug, emoji, color, tint }: GameCardArtProps) {
  const src = GAME_CARD_ART[gameSlug];
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={styles.art} style={{ "--c": color, "--c-tint": tint } as React.CSSProperties}>
      <div className={styles.fallback}>
        <span className={styles.fallbackEmoji}>{emoji}</span>
      </div>
      {showImage && <img className={styles.img} src={src} alt="" onError={() => setFailed(true)} />}
    </div>
  );
}
