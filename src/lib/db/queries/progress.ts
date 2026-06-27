import { supabaseServer } from "@/lib/db/supabase";
import type { TopicProgressRow, StudentRow } from "@/types/db";

export async function getTopicProgress(
  studentId: string,
  topicId: string,
  subtopicId: string | null
): Promise<TopicProgressRow | null> {
  let query = supabaseServer()
    .from("topic_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("topic_id", topicId);

  query = subtopicId ? query.eq("subtopic_id", subtopicId) : query.is("subtopic_id", null);

  const { data, error } = await query.single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as TopicProgressRow;
}

export async function listTopicProgressForStudent(studentId: string): Promise<TopicProgressRow[]> {
  const { data, error } = await supabaseServer().from("topic_progress").select("*").eq("student_id", studentId);
  if (error) throw error;
  return (data ?? []) as TopicProgressRow[];
}

/** Upserts a single TopicProgress row with a freshly-computed mastery score. */
export async function upsertTopicProgress(
  studentId: string,
  topicId: string,
  subtopicId: string | null,
  newMasteryScore: number,
  newAttemptsCount: number,
  isMastered: boolean
): Promise<TopicProgressRow> {
  const { data, error } = await supabaseServer()
    .from("topic_progress")
    .upsert(
      {
        student_id: studentId,
        topic_id: topicId,
        subtopic_id: subtopicId,
        mastery_score: newMasteryScore,
        attempts_count: newAttemptsCount,
        is_mastered: isMastered
      },
      { onConflict: "student_id,topic_id,subtopic_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as TopicProgressRow;
}

export async function addXpToStudent(studentId: string, xpDelta: number): Promise<StudentRow> {
  // Read-modify-write; fine at this scale. Move to a Postgres function/RPC for
  // atomic increments if concurrent writes per student ever become a real concern.
  const { data: student, error: readError } = await supabaseServer()
    .from("student")
    .select("*")
    .eq("id", studentId)
    .single();
  if (readError) throw readError;

  const { data, error } = await supabaseServer()
    .from("student")
    .update({ xp_total: (student as StudentRow).xp_total + xpDelta })
    .eq("id", studentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as StudentRow;
}
