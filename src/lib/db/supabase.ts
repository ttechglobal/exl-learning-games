/**
 * Supabase client singletons.
 *
 * Two clients, deliberately separate:
 * - `supabaseBrowser`: anon key, safe to use in client components, respects RLS.
 * - `supabaseServer`: service role key, SERVER-ONLY (API routes / route handlers).
 *   Bypasses RLS — this is how attempts/mastery get written until student/admin
 *   auth is wired up and proper RLS policies replace this bypass.
 *
 * Never import supabaseServer into a "use client" component — the service role
 * key must never reach the browser bundle.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud failure preferred over a silently broken client in this small-team context.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.example to .env.local and fill in your Supabase project's values."
  );
}

let _browserClient: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
  }
  return _browserClient;
}

let _serverClient: SupabaseClient | null = null;
export function supabaseServer(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("supabaseServer() must never be called from client-side code.");
  }
  if (!_serverClient) {
    _serverClient = createClient(supabaseUrl ?? "", supabaseServiceRoleKey ?? supabaseAnonKey ?? "");
  }
  return _serverClient;
}
