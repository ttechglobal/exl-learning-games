/**
 * lib/content/gameEnvironments.ts
 *
 * Single source of truth for each game's full-bleed ENVIRONMENT
 * background — the same artwork rendered behind both the pre-play flow
 * (see EnvironmentBackdrop.tsx, used by PrePlayShell and GameplayShell)
 * and live gameplay.
 *
 * REORGANIZED per direct instruction ("the game illustrations... I want
 * us to have the images in a particular folder for illustration
 * images"): these full-bleed scene illustrations now live under
 * `public/illustrations/`, separate from `public/mascot/` — which
 * stays focused on the mascot character poses (idle/celebrate/
 * encourage) and the small hand-coded card icons (gameCardMeta.ts).
 * Previously everything (mascot poses, card icons, AND full-bleed
 * scenes) lived flat in one `mascot/` folder with no sub-organization
 * — see docs/ILLUSTRATION_GUIDE.md for the full naming convention and
 * exactly how to add a new background image.
 *
 * NAMING CONVENTION (see docs/ILLUSTRATION_GUIDE.md for the complete
 * version): `illustrations/<game-slug>-desktop.png` and
 * `illustrations/<game-slug>-mobile.png` — one file per breakpoint, per
 * game, named after the game's own slug so the mapping from file name
 * to game is obvious without opening this file at all.
 *
 * TWO IMAGE VARIANTS per game, per direct feedback: a single image
 * cropped via object-fit either loses important detail on phones (a wide
 * desktop-composed scene shrunk into a tall mobile viewport crops most of
 * it away) or looks awkwardly zoomed on desktop (a portrait-composed
 * scene stretched wide). `desktop` and `mobile` can point at the exact
 * same file when only one asset exists yet — see ELEMENT_HUNTER below —
 * but the type always asks for both so a future asset swap to genuinely
 * different art per breakpoint doesn't require touching the type or any
 * call site, only this data.
 *
 * NOT the same registry as gameCardMeta.ts's GAME_CARD_ART — that's the
 * small thumbnail art used on /worlds and the homepage's game cards;
 * this is the large, full-viewport in-world backdrop. Different asset,
 * different aspect ratio expectations, different purpose, different
 * folder.
 *
 * Keyed by game SLUG (not engine type) since a future second game built
 * on the same engine (e.g. another tile-match game) would still need its
 * own distinct environment art, not tile-match's.
 *
 * Only Element Hunter has an entry right now per the current focus on
 * that game specifically — add further entries here (not back inside
 * individual engine components) as more games get their own
 * environment art.
 */

export interface GameEnvironmentImages {
  desktop: string;
  mobile: string;
}

/**
 * Both variants point at the same file for Element Hunter and Atom Forge
 * for now — there is only one source asset for each in this codebase.
 * When a dedicated mobile crop/composition is produced for either,
 * change ONLY `mobile` here; EnvironmentBackdrop already renders
 * desktop/mobile through separate <source> tags driven by a media
 * query, so no component code needs to change when a second asset
 * arrives.
 *
 * Atom Forge's entry added when BondMatchEngine was migrated onto
 * GameplayShell/EnvironmentBackdrop (previously rendered its own raw
 * <img src="/mascot/forge-backdrop.svg"> directly, bypassing this
 * registry and the shared desktop/mobile picture-swap mechanism
 * entirely) — its file moved from `/mascot/forge-backdrop.svg` to
 * `/illustrations/atom-forge-desktop.png` as part of this reorganization
 * (kept as a placeholder path; the actual asset still needs producing
 * against the new generation prompt — see docs/ILLUSTRATION_GUIDE.md).
 */
export const GAME_ENVIRONMENT_IMAGES: Record<string, GameEnvironmentImages> = {
  "element-hunter": {
    desktop: "/illustrations/element-hunter-desktop.png",
    mobile: "/illustrations/element-hunter-mobile.png"
  },
  "atom-forge": {
    desktop: "/illustrations/atom-forge-desktop.png",
    mobile: "/illustrations/atom-forge-mobile.png"
  },
  "carbon-builder": {
    desktop: "/illustrations/carbon-builder-desktop.png",
    mobile: "/illustrations/carbon-builder-mobile.png"
  }
};

export function resolveGameEnvironmentImages(gameSlug: string): GameEnvironmentImages | undefined {
  return GAME_ENVIRONMENT_IMAGES[gameSlug];
}