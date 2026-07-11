"use client";
/**
 * app/(player)/games/math-quest/page.tsx
 *
 * Route: /games/math-quest
 * Loads MathQuestEngine directly — no DB required.
 */

import { useRouter } from "next/navigation";
import { MathQuestEngine } from "@/games/math-quest/MathQuestEngine";

export default function MathQuestPage() {
  const router = useRouter();
  return (
    <MathQuestEngine onExit={() => router.push("/worlds")} />
  );
}