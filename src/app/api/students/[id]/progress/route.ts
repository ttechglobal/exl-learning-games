import { NextRequest, NextResponse } from "next/server";
import { listTopicProgressForStudent } from "@/lib/db/queries/progress";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const progress = await listTopicProgressForStudent(params.id);
    return NextResponse.json({ progress });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
