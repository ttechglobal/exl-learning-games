// FILE: src/app/(admin)/admin/content/[topicId]/page.tsx
import { supabaseServer } from "@/lib/db/supabase";
import { notFound } from "next/navigation";
import TopicDetailClient from "./TopicDetailClient";

export const dynamic = "force-dynamic";

export default async function TopicDetailPage({ params }: { params: { topicId: string } }) {
  const { data, error } = await supabaseServer()
    .from("content_topic")
    .select("*")
    .eq("id", params.topicId)
    .single();

  if (error || !data) notFound();

  return <TopicDetailClient topic={data} />;
}