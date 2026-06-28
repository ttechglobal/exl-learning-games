"use client";

import styles from "@/components/gameplay/HintModal.module.css";

export interface HintContent {
  /** One-line key concept name, shown as the modal's headline — e.g.
   *  "Valence Electrons" or "Atomic Number." Distinct from `explanation`
   *  (the fuller sentence) so the modal has a real visual hierarchy
   *  (headline -> explanation -> tip) instead of one undifferentiated
   *  paragraph, per the brief's "Key concept" + "Short explanation" +
   *  "Practical tip" structure. */
  concept: string;
  explanation: string;
  /** A concrete, actionable next step — distinct from explanation, which
   *  states the RULE; tip states what to actually DO with it right now. */
  tip: string;
  /** Optional emoji/illustration stand-in shown large at the top of the
   *  modal — "helpful illustration where appropriate" per the brief.
   *  Real bespoke illustrations are a future asset-pipeline step (see
   *  docs/ELEMENT_HUNTER_ENVIRONMENT_BRIEF.md's image-generation
   *  workflow notes); an emoji is an honest, zero-asset-cost stand-in
   *  for now, not a placeholder pretending to be final art. */
  illustration?: string;
}

export interface HintModalProps {
  content: HintContent;
  accentColor?: string;
  onClose: () => void;
}

/**
 * Replaces the inline "hintCard" that used to appear directly on the
 * gameplay screen (a small dismissible card competing for the same
 * space as the tile grid). Per the product brief section 7: "display a
 * well-designed modal... the presentation should encourage students to
 * actually read the hint" — a real overlay modal commands attention in a
 * way an inline card sitting among other UI doesn't, and gives Concept /
 * Explanation / Tip each their own visual weight instead of one run-on
 * sentence.
 *
 * Still teaches rather than reveals — see lib/content/teachingHints.ts
 * for where this content actually comes from; this component only
 * presents it.
 */
export function HintModal({ content, accentColor = "var(--eg-subject-chemistry)", onClose }: HintModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ "--accent-color": accentColor } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        {content.illustration && <div className={styles.illustration}>{content.illustration}</div>}

        <div className={styles.conceptLabel}>💡 Key Concept</div>
        <div className={styles.concept}>{content.concept}</div>

        <p className={styles.explanation}>{content.explanation}</p>

        <div className={styles.tipRow}>
          <span className={styles.tipIcon}>👉</span>
          <span className={styles.tipText}>{content.tip}</span>
        </div>

        <button className={styles.closeButton} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}