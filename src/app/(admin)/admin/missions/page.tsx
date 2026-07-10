import { supabaseServer } from "@/lib/db/supabase";
import Link from "next/link";
import styles from "./missions.module.css";

export const dynamic = "force-dynamic";

const DIFF_COLOUR: Record<string, string> = {
  EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444",
};

export default async function MissionsIndexPage() {
  const { data: games } = await supabaseServer()
    .from("game").select("id, title, slug, subject, accent_colour").eq("is_active", true).order("title");

  const { data: missions } = await supabaseServer()
    .from("mission").select("id, game_id, title, difficulty, sequence_index, xp_reward, learning_goal, mission_key, is_active")
    .eq("is_active", true).order("sequence_index");

  const gameMap = new Map((games ?? []).map((g: { id: string; title: string; slug: string; subject: string; accent_colour: string | null }) => [g.id, g]));

  const byGame = new Map<string, typeof missions>();
  for (const m of missions ?? []) {
    const gid = (m as { game_id: string }).game_id;
    if (!byGame.has(gid)) byGame.set(gid, []);
    byGame.get(gid)!.push(m);
  }

  const totalMissions = missions?.length ?? 0;
  const easy   = missions?.filter((m: { difficulty: string }) => m.difficulty === "EASY").length   ?? 0;
  const medium = missions?.filter((m: { difficulty: string }) => m.difficulty === "MEDIUM").length ?? 0;
  const hard   = missions?.filter((m: { difficulty: string }) => m.difficulty === "HARD").length   ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>All Missions</h1>
          <p className={styles.sub}>{totalMissions} missions across {games?.length ?? 0} games</p>
        </div>
        <Link href="/admin/games/upload" className={styles.btnPrimary}>+ Add via Upload</Link>
      </div>

      {/* Summary pills */}
      <div className={styles.pills}>
        <div className={styles.pill}><span className={styles.pillDot} style={{ background: "#22c55e" }}/>{easy} Easy</div>
        <div className={styles.pill}><span className={styles.pillDot} style={{ background: "#f59e0b" }}/>{medium} Medium</div>
        <div className={styles.pill}><span className={styles.pillDot} style={{ background: "#ef4444" }}/>{hard} Hard</div>
      </div>

      {/* Per-game mission lists */}
      {Array.from(byGame.entries()).map(([gameId, gameMissions]) => {
        if (!gameMissions) return null;
        const game = gameMap.get(gameId);
        if (!game) return null;
        const accent = game.accent_colour ?? "#64748b";
        return (
          <div key={gameId} className={styles.gameSection}>
            <div className={styles.gameSectionHeader}>
              <div className={styles.gameSectionBar} style={{ background: accent }}/>
              <div className={styles.gameSectionTitle}>{game.title}</div>
              <div className={styles.gameSectionCount}>{gameMissions.length} missions</div>
              <Link href={`/admin/games/${gameId}/missions`} className={styles.gameSectionLink}>
                Manage →
              </Link>
            </div>

            <div className={styles.table}>
              <div className={styles.tableHead}>
                <div>#</div>
                <div>Mission</div>
                <div>Key</div>
                <div>Difficulty</div>
                <div>XP</div>
              </div>
              {(gameMissions as Array<{ sequence_index: number; title: string; mission_key: string; difficulty: string; xp_reward: number; learning_goal: string | null }>).map(m => (
                <div key={m.mission_key} className={styles.tableRow}>
                  <div className={styles.tableSeq}>{m.sequence_index}</div>
                  <div className={styles.tableMain}>
                    <div className={styles.tableMissionTitle}>{m.title}</div>
                    {m.learning_goal && (
                      <div className={styles.tableMissionGoal}>{m.learning_goal}</div>
                    )}
                  </div>
                  <div className={styles.tableKey}>{m.mission_key}</div>
                  <div>
                    <span className={styles.diffBadge} style={{ color: DIFF_COLOUR[m.difficulty] ?? "#64748b", borderColor: `${DIFF_COLOUR[m.difficulty]}30` }}>
                      {m.difficulty}
                    </span>
                  </div>
                  <div className={styles.tableXp}>{m.xp_reward}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {totalMissions === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◈</div>
          <div className={styles.emptyTitle}>No missions yet</div>
          <div className={styles.emptySub}>Upload a game JSON with missions to get started.</div>
          <Link href="/admin/games/upload" className={styles.btnPrimary}>Upload Game JSON</Link>
        </div>
      )}
    </div>
  );
}