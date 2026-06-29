"use client";

import { useState } from "react";
import { getElementByAtomicNumber } from "@/motion/periodicTableData";
import { CATEGORY_COLORS } from "@/motion/periodicTableData";
import { Mascot } from "@/motion/Mascot";
import { resolveMissionBriefing } from "@/lib/content/missionBriefing";
import { LeaderboardModal } from "@/components/runtime/LeaderboardModal";
import { InlineLeaderboardPreview } from "@/components/runtime/InlineLeaderboardPreview";
import type { MissionRow } from "@/types/db";
import styles from "@/app/(player)/play/[gameSlug]/EntryScreen.module.css";

const SUBJECT_FALLBACK_ACCENT: Record<string, string> = {
  chemistry: "var(--eg-subject-chemistry)",
  biology: "var(--eg-subject-biology)",
  physics: "var(--eg-subject-physics)",
  mathematics: "var(--eg-subject-mathematics)"
};

/**
 * Falls back to a topic_id-derived label when MissionRow.learning_goal is
 * null — true for any mission seeded before that column existed (see the
 * migration caveat on MissionRow.learning_goal). "chemical-bonding"
 * becomes "Chemical Bonding" rather than showing nothing or the raw slug.
 */
function fallbackLearningGoal(topicId: string, subtopicId: string | null): string {
  const label = (subtopicId ?? topicId).replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface EntryScreenProps {
  /** Still needed for resolveMissionBriefing(gameSlug) — this is a lookup
   *  key, not something displayed here. Game title/subject are no longer
   *  props of this component at all; they're shown once, above this
   *  screen, by MissionTopBar (rendered by PrePlayShell, see
   *  PlayClient.tsx). */
  gameSlug: string;
  /** Needed for the View High Scores button — LeaderboardModal fetches
   *  /api/games/[id]/leaderboard, which needs the real DB id, not the
   *  slug. */
  gameId: string;
  gameTitle: string;
  subject: string;
  mission: MissionRow;
  onStart: () => void;
}

/**
 * Mission Briefing screen content — rendered INSIDE PrePlayShell's
 * .content slot (see PlayClient.tsx). No longer owns its own page-level
 * wrapper, backdrop, or min-height:100vh; PrePlayShell handles all of
 * that for the whole pre-play flow now, not just this one screen. This
 * component is just: mascot, narrative briefing, element glyph (when
 * relevant), Learning Goal, View High Scores, and the Start Mission
 * button.
 *
 * Per direct instruction: Reward/Difficulty/Time are REMOVED from this
 * screen entirely (an earlier revision simplified them into one quiet
 * line — that wasn't enough; they don't belong here at all).
 *
 * GAME TITLE / SUBJECT KICKER REMOVED per direct feedback: that
 * information now lives ONCE, in MissionTopBar. MISSION TITLE ALSO
 * REMOVED from the card per a second, more specific round of feedback:
 * with the page title already visible at the top of the screen, showing
 * it again in the card (even as `mission.title` rather than `gameTitle`)
 * read as the same information twice for single-mission games like
 * Element Hunter, where the mission title and the game's identity are
 * effectively the same thing. The element glyph (atomic number + symbol)
 * stays — it's a content preview, not a title, and earns its place on
 * the briefing.
 *
 * Still does the periodic-table-glyph preview for particle-assembly-style
 * missions (target.proton in payload) — unaffected by this revision.
 *
 * VIEW HIGH SCORES + INLINE PREVIEW: per direct feedback, players
 * shouldn't have to complete a mission to see where they (or anyone
 * else) rank, AND the leaderboard should be easily visible "beside the
 * title card," not buried behind an extra tap. So there are now TWO
 * presentations of the SAME leaderboard data (one query, one source of
 * truth — see InlineLeaderboardPreview.tsx's header comment): a small
 * always-visible top-3 strip rendered directly on this card, and the
 * existing "View High Scores" button that still opens the full
 * LeaderboardModal for anyone who wants more than the top few.
 */
export function EntryScreen({ gameSlug, gameId, gameTitle, subject, mission, onStart }: EntryScreenProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const target = (mission.payload as { target?: Record<string, number> }).target;
  const protonCount = target?.proton;
  const element = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
  const accentColor = element ? CATEGORY_COLORS[element.category] : SUBJECT_FALLBACK_ACCENT[subject] ?? "var(--eg-subject-chemistry)";

  const learningGoal = mission.learning_goal ?? fallbackLearningGoal(mission.topic_id, mission.subtopic_id);
  const briefing = resolveMissionBriefing(gameSlug);

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={130} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Mission Briefing</div>

        <p className={styles.briefingText}>{briefing}</p>

        <InlineLeaderboardPreview gameId={gameId} accentColor={accentColor} />

        {element && (
          <div className={styles.elementGlyphRow}>
            <div className={styles.elementGlyph}>
              <span className={styles.elementGlyphNumber}>{element.atomicNumber}</span>
              <span className={styles.elementGlyphSymbol}>{element.symbol}</span>
            </div>
          </div>
        )}

        <div className={styles.goalRow}>
          <div className={styles.goalLabel}>Learning Goal</div>
          <div className={styles.goalText}>{learningGoal}</div>
        </div>

        <button className={styles.highScoresButton} onClick={() => setShowLeaderboard(true)}>
          🏆 View High Scores
        </button>

        <button className={styles.startButton} onClick={onStart}>
          Start Mission
        </button>
      </div>

      {showLeaderboard && (
        <LeaderboardModal
          gameId={gameId}
          gameTitle={gameTitle}
          accentColor={accentColor}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
}