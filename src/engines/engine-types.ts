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
}
