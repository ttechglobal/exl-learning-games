import type { ZodSchema } from "zod";

/**
 * Every engine module exports one of these. registry.ts maps a game's
 * `engineType` string to the matching EngineDefinition. Adding a new engine
 * means adding one new folder under engines/ plus one new entry in
 * registry.ts — nothing else in the codebase needs to change.
 */
export interface EngineDefinition<TConfig = unknown, TOutcome = unknown> {
  engineType: string;
  /** Validates the combination of Game.shared_config + Mission.payload before rendering. */
  configSchema: ZodSchema<TConfig>;
  /** The React component that renders gameplay and calls onComplete when a mission resolves. */
  Component: React.ComponentType<EngineRuntimeProps<TConfig, TOutcome>>;
}

export interface EngineRuntimeProps<TConfig = unknown, TOutcome = unknown> {
  config: TConfig;
  onComplete: (outcome: TOutcome) => void;
  /**
   * True while the player has opened the in-game menu and chosen Pause
   * (see components/runtime/GameMenu.tsx / GameRuntime.tsx). Optional —
   * an engine with no running clock (e.g. particle-assembly's untimed,
   * check-on-submit mechanic) has nothing to pause and can ignore this
   * prop entirely; it's only meaningful for engines that run their own
   * internal timer (tile-match's session countdown, bond-match's factory
   * mode). Each such engine is responsible for halting its OWN timer
   * when this is true — GameRuntime cannot reach into an engine's
   * internal state from outside, since each engine owns its own timer
   * loop independently (see TileMatchEngine.tsx's architectural note).
   */
  isPaused?: boolean;
  /**
   * The in-game menu instance (see components/runtime/GameMenu.tsx),
   * built by PlayClient/GameRuntime (which own the actual
   * pause/restart/exit state) and passed down so each engine can render
   * it inside its own GameplayShell — see components/gameplay/GameplayShell.tsx.
   * Engines never construct their own GameMenu; they only place this
   * ReactNode wherever the shell expects it.
   *
   * MIGRATION STATUS: only tile-match (TileMatchEngine.tsx) actually
   * renders this inside a GameplayShell as of this revision — bond-match
   * and particle-assembly still render their own pre-shell chrome
   * directly and never reference `menu` at all, which means there is
   * currently NO visible in-game menu during their actual gameplay phase
   * (Entry/Difficulty/Objectives/Reflection still show it correctly,
   * via PlayClient's sibling-fragment rendering — only the "playing"
   * phase for these two specific engines is affected). This was a
   * deliberate, scoped decision (tile-match as the proven template
   * first) — not an oversight to silently work around if you're reading
   * this while building a new engine: migrate bond-match and
   * particle-assembly onto GameplayShell before assuming every engine
   * already has a working menu.
   */
  menu?: React.ReactNode;
}