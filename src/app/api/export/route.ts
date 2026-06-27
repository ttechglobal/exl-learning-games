import { NextResponse } from "next/server";

/**
 * STUBBED. Outbound sync endpoint for a future job that pushes attempts to
 * the main platform, IF the integration approach ends up being
 * "this app pushes, main platform pulls" rather than "this app calls main
 * platform's API directly via ApiAdapter." Not wired to anything yet —
 * exists so the route shape is visible in the architecture.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented. Cross-app integration approach is still undecided — see architecture doc open items." },
    { status: 501 }
  );
}
