# _future — placeholder for engines not yet identified

This directory intentionally has no code. It exists in the architecture doc
to signal: expect the engine count to keep growing as genuinely new
interaction shapes are designed (drag-to-place, vector navigation,
equation-balancing, etc.) — see architecture doc Section 8.1 for the
judgment call on "same engine, new content" vs. "new engine needed."

When a new engine is built, give it its own sibling folder under
`src/engines/` (not nested inside this one) and remove this placeholder
note if it's no longer useful as a reminder.
