"use client";
/**
 * app/(player)/games/[slug]/ArcadeGameClient.tsx
 *
 * Client component that dynamically imports and mounts the correct
 * standalone game engine based on the slug.
 *
 * Why dynamic import rather than a static switch?
 * Each game engine is a large component. Bundling all of them together
 * would mean every arcade page loads every engine. Dynamic import per slug
 * keeps each game's JS bundle separate.
 *
 * Adding a new game:
 *   1. Add it to STATIC_ARCADE_GAMES in WorldsClient.tsx (shows in strip)
 *   2. Add it to STANDALONE_GAMES in src/games/index.ts (registers the route)
 *   3. Add a case here in ENGINE_MAP (loads the component)
 *   4. Build the engine at src/games/{slug}/{ComponentName}.tsx
 */

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import styles from "./ArcadeGameClient.module.css";

interface ArcadeGameClientProps {
  slug: string;
  title: string;
}

// ── Engine map ─────────────────────────────────────────────────────────────────
// Add a case here for every new arcade game.
// The loading fallback is a full-screen dark loader matching the game aesthetic.

const LoadingScreen = () => (
  <div className={styles.loading}>
    <div className={styles.loadingDot} />
    <div className={styles.loadingDot} />
    <div className={styles.loadingDot} />
  </div>
);

const ENGINE_MAP: Record<string, React.ComponentType<{ onComplete?: (r: { score: number; hits: number; maxCombo: number; xp: number }) => void; onExit?: () => void }>> = {
  "whack-a-mole": dynamic(
    () => import("@/games/whack-a-mole/WhackAMoleEngine").then(m => ({ default: m.WhackAMoleEngine })),
    { ssr: false, loading: LoadingScreen }
  ),
  // "element-crush": dynamic(...) — add when ready
  // "symbol-drop":  dynamic(...) — add when ready
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ArcadeGameClient({ slug, title }: ArcadeGameClientProps) {
  const router = useRouter();
  const Engine = ENGINE_MAP[slug];

  if (!Engine) {
    return (
      <div className={styles.notFound}>
        <p>Game &ldquo;{title}&rdquo; is not available yet.</p>
        <button onClick={() => router.push("/worlds")}>← Back to Worlds</button>
      </div>
    );
  }

  return (
    <Engine
      onComplete={() => {
        // After completing the game, return to worlds.
        // The done screen inside the engine already gives the player
        // a "Play Again" option, so we only navigate away on explicit continue.
        router.push("/worlds");
      }}
      onExit={() => router.push("/worlds")}
    />
  );
}