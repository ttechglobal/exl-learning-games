/**
 * Per direct instruction: SiteHeader was previously added HERE so every
 * screen under (player)/ got it automatically — including the actual
 * play flow (Mission Briefing, Difficulty Select, Mission Objectives,
 * gameplay, Reflection). That's now reverted: nav should NOT appear
 * inside the game itself, only outside it. SiteHeader moved down to
 * WorldsClient.tsx specifically (the only screen under this group that
 * should still show it); the play route gets its own in-game menu
 * instead (Pause/Restart/Exit — see PlayClient.tsx /
 * components/runtime/GameMenu.tsx), which is a different kind of control
 * than top-level site navigation and belongs to the game screen itself,
 * not a shared layout.
 */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100vh", position: "relative" }}>{children}</main>;
}