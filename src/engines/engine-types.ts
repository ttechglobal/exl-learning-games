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
   * MIGRATION STATUS: tile-match and bond-match both render this inside
   * a real GameplayShell as of this revision. particle-assembly still
   * renders its own pre-shell chrome directly and never references
   * `menu` at all, which means there is currently NO visible in-game
   * menu during ITS "playing" phase specifically (Entry/Difficulty/
   * Objectives/Reflection still show it correctly via PlayClient's
   * sibling-fragment rendering — only particle-assembly's actual
   * gameplay screen is affected). Migrate particle-assembly onto
   * GameplayShell next, following the same pattern bond-match's
   * migration used, before assuming every engine already has a working
   * menu.
   */
  menu?: React.ReactNode;
}