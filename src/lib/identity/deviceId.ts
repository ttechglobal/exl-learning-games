import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getOrCreateStudentByDeviceId } from "@/lib/db/queries/students";
import type { StudentRow } from "@/types/db";

/**
 * lib/identity/deviceId.ts
 *
 * Server-side resolution of "who is making this request" with NO sign-in
 * required — see students.ts's header comment for the full design
 * rationale and the explicitly accepted tradeoff (clearing cookies/
 * switching devices starts a new anonymous player, by design, not a bug).
 *
 * Cookie name deliberately namespaced (`eg_` = "Element Games", matching
 * this app's other cookie/localStorage key prefixes like
 * ThemeProvider.tsx's pattern) rather than something generic like
 * "device_id", to avoid collisions if this app is ever embedded
 * alongside something else that also sets a plain "device_id" cookie.
 *
 * ONE YEAR EXPIRY, not session-only: the entire point of this is that a
 * returning player on the same device keeps their identity/leaderboard
 * history across visits, not just within one browser session.
 */
const DEVICE_ID_COOKIE = "eg_device_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Reads the device-id cookie if present; does NOT set one. Use this in
 * a context that can't write cookies (most Server Components can only
 * read — see resolveCurrentStudent's comment on where the actual
 * set-if-missing happens). Returns null if the cookie was never set,
 * which callers should treat as "no identity yet for this request" —
 * NOT the same as "this device has no student row," since the row only
 * gets created once a device id actually exists.
 */
export async function readDeviceIdCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEVICE_ID_COOKIE)?.value ?? null;
}

/**
 * Returns this device's existing id, or mints and persists a brand new
 * one. MUST be called from a context allowed to set cookies — a Route
 * Handler or Server Action, not a plain Server Component render (Next.js
 * throws if you try to call cookies().set(...) during a render). See
 * resolveCurrentStudent below for how page.tsx (a Server Component)
 * works around that constraint without itself needing to set cookies.
 */
export async function getOrCreateDeviceIdCookie(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_ID_COOKIE)?.value;
  if (existing) return existing;

  const fresh = randomUUID();
  store.set(DEVICE_ID_COOKIE, fresh, {
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return fresh;
}

/**
 * The one function most pages should actually call. Returns the current
 * device's real StudentRow, end to end — reads the cookie if present
 * (works from a plain Server Component render), and otherwise returns
 * null rather than trying to set one itself.
 *
 * WHY THIS DOESN'T MINT A COOKIE ON A COLD VISIT: a Server Component's
 * render (e.g. RootPage in app/page.tsx) is NOT allowed to call
 * cookies().set(...) in Next.js — only Route Handlers and Server Actions
 * can. So a true first-ever visit (no cookie yet) intentionally renders
 * once with no resolved student (null), and the page's client side is
 * responsible for calling POST /api/identity (see that route) to mint
 * the cookie via a real Route Handler — after which a normal navigation
 * or refresh resolves a real student here. This means the VERY FIRST
 * paint of a brand new visitor's session may briefly show no
 * personalized state (e.g. no "your XP" pill) until that round-trip
 * completes — an accepted UX tradeoff of "no sign-in, but still need a
 * cookie," not an oversight.
 */
export async function resolveCurrentStudent(): Promise<StudentRow | null> {
  const deviceId = await readDeviceIdCookie();
  if (!deviceId) return null;
  return getOrCreateStudentByDeviceId(deviceId);
}
