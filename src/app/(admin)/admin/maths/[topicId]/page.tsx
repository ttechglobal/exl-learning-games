// FILE: src/app/(admin)/admin/maths/[topicId]/page.tsx
import { supabaseServer } from "@/lib/db/supabase";
import { notFound } from "next/navigation";
import MathsTopicClient from "./MathsTopicClient";

export const dynamic = "force-dynamic";

export default async function MathsTopicPage({ params }: { params: { topicId: string } }) {
  const { data, error } = await supabaseServer()
    .from("maths_topic")
    .select("*")
    .eq("id", params.topicId)
    .single();

  if (error || !data) return notFound();

  return <MathsTopicClient topic={data} />;
}