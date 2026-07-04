/**
 * lib/content/gameEnvironments.ts
 *
 * Re-exports from gameThemes.ts so all existing call sites continue
 * to work without changes. Do NOT add new entries here — edit
 * lib/content/gameThemes.ts instead.
 */
import { GAME_THEMES, getGameTheme, type GameEnvironment } from "@/lib/content/gameThemes";

export type { GameEnvironment as GameEnvironmentImages };

export const GAME_ENVIRONMENT_IMAGES: Record<string, GameEnvironment> = Object.fromEntries(
  Object.entries(GAME_THEMES)
    .filter(([, t]) => t.environment)
    .map(([slug, t]) => [slug, t.environment!])
);

export function resolveGameEnvironmentImages(slug: string): GameEnvironment | undefined {
  return GAME_THEMES[slug]?.environment;
}

/** Used by PrePlayShell to set the pre-game background colour */
export function resolveGameThemeGradient(slug: string): string {
  return getGameTheme(slug).preGameGradient;
}
