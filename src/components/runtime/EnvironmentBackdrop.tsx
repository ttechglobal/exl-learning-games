import type { GameEnvironmentImages } from "@/lib/content/gameEnvironments";
import styles from "@/components/runtime/EnvironmentBackdrop.module.css";

export interface EnvironmentBackdropProps {
  images?: GameEnvironmentImages;
  /** Fallback raw <img> src for screens that don't yet have an entry in
   *  gameEnvironments.ts (or any future game without environment art at
   *  all) — same single generic backdrop every pre-play screen used
   *  before this component existed. */
  fallbackSrc?: string;
  /** Darkens/flattens the image so foreground text and cards keep full
   *  contrast regardless of what's in the underlying art. Off by default
   *  since GameplayShell's gameplay area already has its own opaque
   *  panel sitting on top of the backdrop and doesn't need a scrim under
   *  it too; pre-play screens (the briefing card, the difficulty tiers,
   *  the objectives list) DO need it, since their content sits more
   *  directly over the open backdrop. */
  scrim?: boolean;
  /** Shifts the cover-crop focal point toward the lower portion of the
   *  image instead of dead-center — see .focusLower's comment in the CSS
   *  for why GameplayShell needs this and PrePlayShell doesn't. */
  focusLower?: boolean;
}

/**
 * Single shared implementation of "show this game's environment art,
 * full-bleed, with a desktop image and a mobile image" — used by BOTH
 * PrePlayShell (the whole pre-gameplay flow: briefing, difficulty,
 * objectives) and GameplayShell (live gameplay). Built once here instead
 * of twice so the desktop/mobile picture-swap mechanism and the scrim
 * treatment can never drift between the two contexts.
 *
 * TWO IMAGES, PICKED BY THE BROWSER NOT JS: a <picture> element with a
 * <source media="(max-width: 767px)"> for the mobile variant and a plain
 * <img> fallback for desktop — the browser decides which one to actually
 * download based on viewport width at load time, so there's no flash of
 * the wrong image and no JS-driven layout shift from swapping sources
 * after mount. 767px matches GameplayShell/PrePlayShell's own mobile
 * breakpoint so the image switch lines up with every other layout change
 * at that width.
 *
 * onError hides the broken image rather than letting the browser show
 * its default broken-image icon full-screen — same defensive behavior
 * GameplayShell's old single <img> had, kept here now that this is the
 * one place that logic lives.
 */
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

export function EnvironmentBackdrop({ images, fallbackSrc, scrim, focusLower }: EnvironmentBackdropProps) {
  if (!images && !fallbackSrc) return null;
  const backdropClass = focusLower ? `${styles.backdrop} ${styles.focusLower}` : styles.backdrop;

  return (
    <>
      {images ? (
        <picture>
          <source media="(max-width: 767px)" srcSet={images.mobile} />
          <img src={images.desktop} alt="" role="presentation" className={backdropClass} onError={hideOnError} />
        </picture>
      ) : (
        <img src={fallbackSrc} alt="" role="presentation" className={backdropClass} onError={hideOnError} />
      )}
      {scrim && <div className={styles.scrim} />}
    </>
  );
}