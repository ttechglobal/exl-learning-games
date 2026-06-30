/**
 * Hand-mirrored types for the Supabase schema (supabase/migrations/0001_init.sql).
 *
 * There's no ORM generating these from the schema (we dropped Prisma for the
 * Supabase JS client + SQL migrations), so these must be kept in sync by hand
 * whenever a migration changes a table shape. Column names are snake_case to
 * match Postgres directly; mapping to camelCase (if desired) happens in
 * lib/db/queries/*, not here.
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface GameRow {
  id: string;
  slug: string;
  title: string;
  engine_type: string;
  subject: string;
  topic_id: string;
  subtopic_id: string | null;
  shared_config: Record<string, unknown>;
  /**
   * Quick Concepts — a short series of titled cards shown before gameplay
   * (and reviewable after, via ReflectionScreen's "View Concept Summary").
   * Each card is ONE idea, per the product brief's example ("Atomic
   * Number" / "Periodic Table" / "Helpful Tip") — not a flat block of
   * lines. Previously `{ lines: string[]; readTimeSec: number }` (a
   * single countdown over an undifferentiated block of text); replaced
   * because the brief asks players to move between cards and skip
   * individually, which a single shared countdown can't represent. No
   * stored time budget anymore — pacing is now player-driven (tap through
   * or skip), not a timer.
   *
   * REQUIRES A MIGRATION: existing rows have the old `{lines, readTimeSec}`
   * shape in their `snapshot` jsonb column — this is a breaking shape
   * change, not an additive one (unlike learning_goal/estimated_minutes on
   * MissionRow, which were nullable additions). Every game's `snapshot`
   * column needs to be rewritten to `{cards: [...]}` before this type is
   * accurate at runtime. Not present in this checkout (no
   * supabase/migrations/*.sql included) — see content/games/chemistry/*.json
   * for the new shape each game's seed data now uses; the seed script
   * needs to write that same shape into the DB.
   */
  snapshot: { cards: { title: string; body: string }[] };
  /**
   * How the player moves between this game's missions — see
   * PlayClient.tsx's header comment for the full explanation of why
   * this exists as an explicit column rather than staying inferred.
   *
   * Previously, PlayClient auto-detected "level-based" purely from
   * whether mission difficulty values varied across the list (`new
   * Set(missions.map(m => m.difficulty)).size > 1`). That heuristic
   * broke for Carbon Builder: its 11 missions deliberately span
   * EASY/MEDIUM/HARD as a single staged sequence (hydrogen gas all the
   * way to isobutane), not free-choice levels — but mixed difficulty
   * values triggered the same "show a flat unordered picker, never
   * auto-advance" behavior built for Atom Forge's genuinely-separate
   * levels. Same data shape, two different intended experiences; an
   * inferred flag couldn't tell them apart.
   *
   * - "linear": straight chain by sequence_index, auto-advances via
   *   the Reflection screen's Next Mission button. No picker shown.
   *   (Element Hunter, Build the Atom.)
   * - "levelSelect": flat, unordered grid; player can play any mission
   *   anytime in any order; completing one never auto-advances, it
   *   returns to the grid. (Atom Forge — levels are genuinely
   *   different mechanics, not a sequence.)
   * - "trackMap": ordered, LOCKED path — mission N+1 is locked until
   *   N has at least one successful attempt; shown as a track/map, not
   *   a flat grid. (Carbon Builder.)
   *
   * Nullable for backward compatibility with existing seeded rows
   * (same additive-column pattern as MissionRow.learning_goal) — null
   * falls back to the OLD inferred behavior (mixed difficulty ->
   * levelSelect, else linear) so already-seeded games keep working
   * unchanged without needing a migration before this ships.
   */
  progression_mode: "linear" | "levelSelect" | "trackMap" | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissionRow {
  id: string;
  game_id: string;
  mission_key: string;
  title: string;
  difficulty: Difficulty;
  sequence_index: number;
  xp_reward: number;
  topic_id: string;
  subtopic_id: string | null;
  /**
   * Human-readable sentence describing the concept this mission practises —
   * distinct from `title` (the mission's NAME, e.g. "Level 1: Ionic
   * Bonds") and from `topic_id` (a bare slug like "ionic-bonds" with no
   * stored label). Shown on EntryScreen's Mission Briefing as "Learning
   * Goal". Nullable because older seeded missions predate this column —
   * EntryScreen falls back to a topic_id-derived label when absent rather
   * than rendering nothing.
   *
   * REQUIRES A MIGRATION: `alter table mission add column learning_goal
   * text;` — not present in this checkout (no supabase/migrations/*.sql
   * was included), so this column does not exist in any real database
   * yet. Do not assume this field is populated until that migration runs
   * AND the seed script is updated to write it from content JSON's new
   * `learningGoal` field (see content/games/chemistry/atom-forge.json).
   */
  learning_goal: string | null;
  /**
   * Estimated minutes to complete this specific mission, shown on the
   * Mission Briefing. Distinct from `snapshot.readTimeSec` on GameRow,
   * which times only the Concept Snapshot step, not the whole mission.
   * Same migration/seed caveat as `learning_goal` above.
   */
  estimated_minutes: number | null;
  payload: Record<string, unknown>;
  is_active: boolean;
}

export interface StudentRow {
  id: string;
  external_id: string | null;
  display_name: string;
  xp_total: number;
  created_at: string;
  /** Optional, player-entered — added per direct feedback ("students
   *  should be able to add school, class"). Both null until a student
   *  fills them in via the profile edit form; neither is required to
   *  play, earn XP, or appear on the leaderboard. */
  school: string | null;
  class_name: string | null;
}

export interface AttemptRow {
  id: string;
  student_id: string;
  game_id: string;
  mission_id: string | null;
  topic_id: string;
  subtopic_id: string | null;
  success: boolean | null;
  score: number | null;
  time_spent_sec: number | null;
  attempts_before_success: number | null;
  xp_awarded: number;
  raw_outcome: Record<string, unknown>;
  completed_at: string;
}

export interface TopicProgressRow {
  id: string;
  student_id: string;
  topic_id: string;
  subtopic_id: string | null;
  mastery_score: number;
  attempts_count: number;
  is_mastered: boolean;
  updated_at: string;
}

/**
 * Lightweight analytics signal — see types/event.ts's AnalyticsEvent for
 * the full design rationale (why this is a separate stream from
 * `attempt`, not more columns added to it). `name` is intentionally
 * `string` here rather than the narrower AnalyticsEventName union —
 * this file mirrors the DB schema as Postgres actually stores it (a
 * plain text column, no enum constraint in this checkout's migration),
 * while the union lives at the application layer in types/event.ts. Kept
 * separate from AttemptRow above on purpose: an event row never updates
 * mastery_score or xp_total, and may exist with no corresponding
 * attempt at all (e.g. mission_abandoned, or mission_viewed before a
 * mission is even chosen).
 */
export interface EventRow {
  id: string;
  name: string;
  student_id: string;
  game_id: string;
  mission_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  detail: Record<string, unknown>;
  occurred_at: string;
}

/** Shape passed to supabase-js's generic typing, e.g. supabase.from<GameRow>('game') */
export interface Database {
  game: GameRow;
  mission: MissionRow;
  student: StudentRow;
  attempt: AttemptRow;
  topic_progress: TopicProgressRow;
  event: EventRow;
}