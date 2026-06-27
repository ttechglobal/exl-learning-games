# Game Specification Standards

This document is the checklist every game must satisfy, regardless of
subject or mechanic. It's separate from `game-design-template.md` on
purpose: the template is what you fill in per game; this is what you
check against afterward. A filled-in template that violates something
here isn't ready to build yet — flag the conflict before sending it over,
or expect me to flag it back.

Like the template and the architecture doc's quality-bar checklist
(Section 7.1), this is a living document. Edit it as new games reveal gaps,
the same way the visual quality bar grew out of Build The Atom and Atom
Forge in practice rather than being designed top-down.

---

## 1. Content Standards

- Every scorable unit must resolve to a real topic/subtopic ID from the
  actual ExamPrep curriculum — not a game-invented category. This is the
  non-negotiable data contract from the original project brief: mastery
  data has to mean something to the main platform, not just to the game.
- Content volume should support real replay, not just a demo. A rule of
  thumb: enough distinct content items that a student playing daily for
  two weeks doesn't see exact repeats constantly. (Element Hunter's jump
  from 18 to 36 elements was this rule applied after the fact — the
  smaller pool wasn't wrong, it just wasn't enough for the game's own
  premise of breadth.)
- Content must be factually correct, even under simplification. Simplify
  scope (fewer cases, easier subset), never simplify into something
  false. (The H2O-as-1:1-bond near-miss in Atom Forge's redesign is the
  cautionary example — we swapped the compound rather than teach wrong
  stoichiometry.)
- Distractors/wrong options must be genuinely plausible, not random
  filler — a wrong answer should represent a real misconception, not an
  obviously-silly option, or the game stops testing understanding.

## 2. Environment Standards

- Every game gets a layered, painted backdrop — far/near depth, a
  specific sense of place. Flat colors or single gradients don't pass. See
  architecture doc Section 7.1 for the full checklist (mascot presence,
  tactile UI, weighted motion) — that checklist is binding for every game,
  not optional polish.
- Environment varies, the system doesn't. A game's setting (lab,
  mountainside, arcade grid, workshop) is free to differ; the production
  values (depth, motion weight, button tactility) are not. If a new game's
  environment doesn't fit any existing backdrop, that's expected — build a
  new one. If a new game's environment is an excuse to skip the quality
  bar, that's not acceptable.
- One accent color per subject, reused across that subject's games. Don't
  invent a new accent per game within the same subject — that's what
  makes subjects feel coherent on the World Map.

## 3. Level / Progression Standards

- State explicitly what gets harder: content (harder questions, same
  mechanic), mechanic (a genuinely new interaction introduced partway,
  like Atom Forge's covalent-bond animation at Level 2), or both. "Two
  levels that play identically with different labels" is not a real
  progression — this was the exact critique that led to Atom Forge's
  redesign.
- Decide timed vs. untimed deliberately, not by default. Untimed fits
  mastery-style learning (Build The Atom, Atom Forge Levels 1-3); timed
  fits arcade/recall-speed games (Element Hunter, Atom Forge's Factory
  level). Mixing the two within one game needs a clear reason.
- If progression should adapt to student performance (not just fixed
  order), say so explicitly in the brief — see architecture doc Section 6.
  Default is fixed order; adaptive is opt-in and currently engine-local
  (Element Hunter's tier system) rather than the platform-wide
  adaptivePolicy, which is still a placeholder.

## 4. Mechanic / Engine Standards

- Name the exact moment of truth — the one input that gets checked (a
  drop, a release, a tap), not a general description of "playing the
  level." Without this, engine-fit can't be judged.
- New engine vs. existing engine is a shape question, not a flavor
  question. Two games can look completely different (different backdrop,
  different content) and still share an engine if the input/check/
  feedback shape matches. Don't request a new engine because a game
  "feels different" — request one because the moment of truth is
  structurally different. See architecture doc Section 8.1.
- Every engine's outcome must normalize into the platform's AttemptResult
  shape (success/score, topicId, optional attemptsBeforeSuccess). If a
  mechanic doesn't have a natural pass/fail or score, decide which it
  reports before building, not after.

## 5. Feedback & Tone Standards

- No punishment, only guidance, per the original project brief. Wrong
  answers get a hint and a gentle consequence (lost time, reset combo) —
  never a harsh fail state, never content framed as a punishment ("System
  Warning" was rejected in favor of "Almost there" for exactly this
  reason).
- The mascot appears at every key emotional beat: idle/greeting at entry,
  celebrate on success, encourage on failure. This is not decorative —
  it's load-bearing tone, and it's the same character across every game
  (Section 7.1).
- Hints are opt-in by default, not proactive from round one, unless a
  game's brief says otherwise. Element Hunter's rule — hint appears only
  after one wrong attempt — is the reference pattern: fast play stays
  fast, struggling play gets help.

## 6. Scoring & Data Standards

- XP and mastery score are separate signals, always. XP is engagement
  (feeds the cross-game leaderboard); mastery score is learning (feeds the
  main platform's study-plan logic). Never conflate them in a game's
  design — a game can award lots of XP for fun replay value without that
  inflating mastery, and vice versa.
- High score is opt-in per game, not universal. Mastery-style games
  (Build The Atom, Atom Forge's non-timed levels) don't have a meaningful
  "score" — don't force one in just for consistency.
- Every game that has a high score automatically feeds the one cross-game
  XP leaderboard. No per-game or per-subject leaderboard unless explicitly
  decided otherwise (current standing decision, open to revisiting once
  there are more games per subject to make that meaningful).

## 7. Session Structure Standards

- Every game gets a Concept Snapshot before play (2-3 lines, ~20-60s) and
  the standard Reflection screen after. These are not optional UI —
  they're the learning loop from the original product brief (Learn -> Play
  -> Reflect -> Practice -> Improve).
- A game-specific Reflection addition (like the Periodic Table reveal) is
  fine and encouraged when it reinforces THAT game's specific concept —
  but it must be additive to the standard Reflection screen via its
  extraContent slot, never a replacement for it.

---

## How this doc relates to the others

- game-design-template.md — fill this in per game. It asks the questions;
  this doc is what the answers need to satisfy.
- architecture.md Section 7.1 — the specific visual quality-bar checklist
  (painted depth, mascot, tactile UI, motion weight) referenced above.
  That's the canonical source for visual rules; this doc points to it
  rather than duplicating it.
- architecture.md Section 8.1 — the engine-vs-content judgment call,
  referenced above in Section 4.

When these documents conflict (they shouldn't, but living docs drift),
architecture.md wins on technical/architectural questions, this doc wins
on content/design/tone questions.
