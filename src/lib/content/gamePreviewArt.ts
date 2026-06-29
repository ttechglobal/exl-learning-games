/**
 * lib/content/gamePreviewArt.ts
 *
 * A THIRD per-game image registry, distinct from the other two that
 * already exist in this codebase:
 *   - gameEnvironments.ts's GAME_ENVIRONMENT_IMAGES: the large,
 *     full-bleed backdrop behind the whole pre-play flow and live
 *     gameplay (wide landscape, cropped via object-fit: cover).
 *   - gameCardMeta.ts's GAME_CARD_ART: the small thumbnail on the
 *     homepage/worlds grid.
 *   - THIS FILE: a focused, square-ish "what you're about to play"
 *     preview illustration shown INSIDE the Mission Briefing and
 *     Mission Objectives cards specifically. Added per direct feedback
 *     that those two screens were showing no real per-game visual at
 *     all (Mission Briefing's only prior "preview" was a periodic-table
 *     glyph that only ever rendered for particle-assembly-style
 *     missions with a `target.proton` field — Carbon Builder and any
 *     non-atom-targeting game showed nothing).
 *
 * Why a fourth registry isn't overkill: each of the three serves a
 * genuinely different aspect ratio and rendering context (wide
 * full-bleed backdrop vs. small thumbnail vs. a contained
 * card-illustration), and conflating them would mean compromising one
 * use case to serve another (e.g. a wide backdrop image looks
 * awkwardly letterboxed inside a square card slot).
 *
 * Single image per game (no separate desktop/mobile variant) since this
 * renders inside a width-constrained card on every breakpoint, not as a
 * full-viewport backdrop — the cropping/aspect-ratio problem
 * gameEnvironments.ts's two-variant system exists to solve doesn't apply
 * here the same way.
 */

export const GAME_PREVIEW_ART: Record<string, string> = {
  "element-hunter": "/mascot/preview-element-hunter.png",
  "atom-forge": "/mascot/preview-atom-forge.png",
  "carbon-builder": "/mascot/preview-carbon-builder.png"
};

export function resolveGamePreviewArt(gameSlug: string): string | undefined {
  return GAME_PREVIEW_ART[gameSlug];
}
