# Environment Asset Brief — Element Hunter

Grounded in the real screen, not a mood board: `TileMatchEngine.tsx`
renders, top to bottom, a HUD card row (Time / Score / streak / tier), a
clue text block, a centered 3-column tile grid (max ~520px wide), and a
hint button beneath it — currently against a plain, empty background.
This brief specifies exactly what art fills that empty space without
ever competing with the HUD numbers, the clue text, or tile legibility.

---

## 1. What this environment needs to communicate

Element Hunter is "hunt down the right element before time runs out" —
a search/detection feeling, not a calm classroom feeling. The brief that
named this game called for "shelves, periodic table, scientific
lighting" (Phase 1 design philosophy doc) — this asset should deliver
that specifically for a *hunting* game, not a generic lab.

## 2. The non-negotiable constraint

**The center ~55% of the frame (where the tile grid sits) must stay
visually quiet.** No high-contrast detail, no bright color, no
busy texture directly behind where tiles render — element symbols and
numbers need to read instantly against whatever's behind them. All the
"environment personality" belongs in the outer 20-25% margins on each
side and the top/bottom bands above the HUD and below the hint button.

## 3. Exact asset specification

**Format**: Single static background image (PNG or WebP, **not** SVG —
photographic/painted detail doesn't compress well as vectors), full
viewport width, tall enough to cover `min-height: 60vh` plus margin —
target **1600×1400px minimum**, so it scales cleanly on both phone and
desktop without visible stretching. Static, not animated — matches the
project's stated preference for "high-quality static artwork with
interactive foreground elements" (Universal Game Design Framework, Part
4) over animated/heavy backgrounds, which keeps this light enough for
low-end Android.

**Composition** (literally, left to right):
- **Left margin (~20% of width)**: a tall laboratory shelf, slightly out
  of focus, holding labeled glass jars and a partial wall-mounted
  periodic table chart, cropped at the edge — implies "this lab has more
  to see," doesn't compete with anything
- **Center (~55-60% of width)**: a clear, softly-lit lab bench surface or
  neutral wall — genuinely plain, this is where the tile grid will sit
  on top
- **Right margin (~20% of width)**: a small workstation detail — a
  magnifying glass or scanner device resting on the bench, hinting at
  "searching/detecting" rather than generic lab clutter
- **Top band**: dim overhead lab lighting (pendant lights or fluorescent
  panels), kept dark enough that light HUD card text/icons stay readable
  on top of it
- **Bottom band**: bench edge fading to a soft shadow, not a hard line —
  gives the hint button some grounding without a visible seam

**Color & lighting**: cool-toned, slightly desaturated lab lighting —
blues and cool whites, not warm yellow — consistent with "scientific
lighting" from the original brief. Should read as **night-shift lab**
energy (focused, slightly tense, searching) rather than bright daytime
classroom energy, matching the "before time runs out" pressure of the
mechanic.

**Style**: painted/illustrated, not photographic — matches the existing
mascot illustration style already used on `EntryScreen`'s backdrop and
elsewhere in this app, so this doesn't introduce a second clashing art
style.

## 4. Suggested image-generation prompt

> A wide illustrated science laboratory background, painted digital art
> style matching a friendly mobile learning game. Cool blue-toned
> scientific lighting, slightly dim and focused like a night shift.
> Left side: a tall wooden shelf holding labeled glass jars and beakers,
> with a partial periodic table chart on the wall behind it, slightly
> out of focus. Center: a clear, mostly empty lab bench surface or plain
> wall — deliberately uncluttered and low-contrast, no objects in the
> direct center. Right side: a small brass magnifying glass and a
> handheld scanner device resting on the bench edge. Dim pendant lab
> lights along the top edge. Soft shadow along the bottom edge. No
> characters, no text, no periodic table close enough to read element
> symbols. 1600x1400, landscape orientation, flat illustrated style, not
> photorealistic.

## 5. How it integrates with the existing code

Once you have the image:
1. Save it as `/public/mascot/scene-element-hunter.png` (or `.webp`) —
   following the existing `/mascot/scene-backdrop.svg` naming convention
   already used by `EntryScreen.tsx`
2. I'll add it as a background layer behind `TileMatchEngine`'s `.screen`
   container, with the tile grid given an explicit semi-transparent or
   solid backing panel so the "stay quiet in the center" requirement is
   enforced in code too, not just trusted to the image alone
3. Same asset can be reused as Element Hunter's card art in
   `lib/content/gameCardMeta.ts` (currently has no entry — see that
   file's `GAME_CARD_ART`), closing a second gap with one piece of art

## 6. What I need back from you

Either:
- The generated/commissioned image file itself (any common format,
  I'll convert/optimize it), or
- Tell me to proceed with a simpler CSS-only treatment instead (gradient
  + a few simple shapes, zero real art) if commissioning art isn't worth
  it for this one game yet
