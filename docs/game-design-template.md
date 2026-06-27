# Game Design Input Template

This is the structure to fill in whenever you want a new game built. Answer
each section — even briefly — and a build can start immediately without
back-and-forth to recover missing structure. Skipping a section just means
I'll make a default assumption and flag it, rather than blocking.

This template was extracted from what already worked: Atom Forge's and
Element Hunter's briefs, after the fact, both map cleanly onto every
section below. Worked examples are included after the blank template so you
can see the mapping is real.

---

## 1. Identity

- **Game title:**
- **Subject / topic area:** (e.g. Chemistry, Mathematics — drives which content folder and which exam topics this reports mastery against)
- **One-line fantasy:** what is the player pretending to be/do? ("You are an Element Engineer repairing a broken machine.")

## 2. Environment

- **Setting:** where does this take place? (a lab, a snowy mountain, an arcade grid — this becomes the painted backdrop)
- **Visual mood word(s):** 2-3 adjectives (cosy, energetic, futuristic, calm) — this is what actually varies game-to-game; see Section 7.1 of the architecture doc for what does NOT vary (the quality bar itself)
- **Does this reuse an existing environment, or need a new painted backdrop?**

## 3. Core Mechanic

- **What does the player physically do?** One sentence, verb-first. ("Drag two atoms together." "Tap the matching tile before the clock runs out.")
- **What is the moment of truth?** The single action that gets checked right/wrong (a drop, a release, a tap — not "playing the level," the one specific input).
- **Does this fit an existing engine, or need a new one?** If unsure, describe the moment of truth and I'll judge — see the architecture doc's Section 8.1 judgment call (same engine + new content vs. genuinely new engine).

## 4. Progression

- **How many levels/stages?**
- **What gets harder each level — content, mechanic, or both?** (e.g. "same mechanic, harder questions" vs. "Level 2 introduces a genuinely new bond type")
- **Is there a difficulty curve within a level too, or is each level flat difficulty throughout?**
- **Timed, or untimed?** If timed, what happens at zero — hard stop, or just "round ends, see your score"?

## 5. Content Scope

- **List the actual content items for v1** (elements, formulas, questions, whatever the game's unit of content is). Doesn't need to be exhaustive — enough to build and seed a first playable version.
- **Is there a known content gap to fill later?** (e.g. "only 18 elements for now, more later")

## 6. Feedback Rules

- **On success:** what's the payoff? (default: burst + reward card + mascot celebrate + XP, per the architecture doc's quality bar — only specify if you want something different)
- **On failure/wrong answer:** what's the consequence, if any? (default: gentle shake + mascot encourage + hint, no hard penalty — name a real penalty here if you want one, e.g. "lose a life," "lose time")
- **Hints:** on by default, or only after N wrong attempts, or off entirely?

## 7. Session Bookends

- **Before play:** Concept Snapshot content — what 2-3 facts should the student see before starting? (Keep this section growing in depth over time — this is the "make the lesson much better" thread, tracked as its own ongoing improvement, not a per-game ask.)
- **After play:** does this game need anything beyond the standard Reflection screen (mastery update, play again, next mission)? Note here if it should also show an end-of-session concept review.

## 8. Scoring & Competition

- **High score:** does this game have a natural numeric score worth tracking as a personal best? (Most arcade-style games: yes. Most mastery-style games like Build The Atom: no — mastery isn't a "score.")
- **Leaderboard:** games with a high score feed the one cross-game XP leaderboard automatically — no per-game decision needed unless you want to deviate from that default.

---

## Worked Example A: Element Hunter

1. **Identity** — Element Hunter. Chemistry. "You're a fast-thinking element scout racing the clock."
2. **Environment** — bright arcade grid, energetic/fast mood, new backdrop (built: `hunter-backdrop.svg`).
3. **Core Mechanic** — tap the tile matching the clue. Moment of truth: the tap itself, checked instantly against the clue's match rule. New engine (tile-clue-match shape didn't exist yet).
4. **Progression** — *(gap at the time — this is exactly the "no clear progression" feedback that's now being fixed; see Action Items below)*.
5. **Content Scope** — 18 elements (atomic number 1-18). Known gap: "need more chemistry elements" (also in Action Items).
6. **Feedback Rules** — success: burst + score pop + streak counter; failure: shake + mascot-encourage + small time penalty, no hard fail. Hints: none yet (also flagged as a gap).
7. **Session Bookends** — title/how-to-play only; no concept snapshot or end review yet (gap).
8. **Scoring** — high score: yes, score + best streak. Leaderboard: feeds the cross-game XP leaderboard once that exists.

## Worked Example B: Atom Forge (v3)

1. **Identity** — Atom Forge. Chemistry. "You're an Element Engineer repairing a broken compound-forging machine."
2. **Environment** — cosy crystal workshop, warm/cosy mood, reused backdrop (`forge-backdrop.svg`).
3. **Core Mechanic** — drag one atom near another. Moment of truth: the drop, checked against the current mission's valid pair. Reused/extended the drag-to-bond engine.
4. **Progression** — 4 levels, and tellingly, BOTH content and mechanic get harder: L1 ionic only, L2 covalent (new animation), L3 mixed with no bond-type hint, L4 adds a real constraint (timer + quantities). Within a level, missions just cycle — no within-level ramp.
5. **Content Scope** — 9 elements, 7 named compounds across the 4 levels.
6. **Feedback Rules** — success: electron-transfer or electron-sharing animation (bond-type-specific) + burst + compound card; failure: shake + hint, and on Level 4 specifically a funny harmless "poof" explosion instead of the standard spark.
7. **Session Bookends** — per-level How To Play screens; no concept snapshot or end-of-session review yet (same gap as Element Hunter).
8. **Scoring** — high score: yes, XP per level. Leaderboard: same cross-game XP pool.

---

## Open action items surfaced by these two worked examples

These came directly out of filling in the template against what's already built — they're now tracked as standing improvements to make across ALL games, not one-off asks per game:

- [ ] **Section 7 (Session Bookends) needs real investment.** Concept Snapshot content has stayed thin since the original Build The Atom spec; this needs an actual content-writing pass, not just a UI slot.
- [ ] **End-of-session concept review** is a new screen type, not yet built anywhere. Needs its own design (likely: a short recap of the 2-3 facts taught, shown once per session, not per mission).
- [ ] **Hints** exist as the failure-feedback hint text, but nothing proactive (e.g. "stuck? tap for a hint" before failing). Worth deciding whether this becomes a standard feature of the runtime (Section 7.2 of the architecture doc) rather than a per-game choice.
- [ ] **Element Hunter needs explicit progression** (easy → hard clue mixing, e.g. start atomic-number-only, introduce valence/group clues later) instead of one flat difficulty for the whole session.
- [ ] **Element Hunter's content pool (18 elements) is thin** for a game whose whole premise is breadth — extend `ELEMENTS` before this goes further.
- [ ] **Leaderboard (cross-game XP) is not built yet** — currently `Student.xp_total` exists in the schema, so the data is already there; this is a ranking query + a UI screen, not new architecture.
