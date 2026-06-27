"use client";

import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";

/**
 * Per direct instruction: the play flow (Mission Briefing, Difficulty
 * Select, Mission Objectives, gameplay, Reflection) had NO navigation at
 * all — added here, once, so every screen under (player)/ gets it
 * automatically rather than each screen needing its own copy. Uses the
 * shared ThemeProvider (app/layout.tsx) so the toggle here is the exact
 * same state as Home/Worlds, not a fourth independent copy.
 */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <main style={{ minHeight: "100vh", position: "relative" }}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />
      {children}
    </main>
  );
}