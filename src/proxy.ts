import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Refreshes the Supabase session cookie on every matched request so that the
 * server-side client (Server Components, Route Handlers) always sees a current
 * access token. Without this proxy, the access token expires after ~1 hour and
 * the SDK cannot persist refreshed cookies from Server Components, which
 * manifests as random admin logouts / early session termination.
 *
 * Only touches Supabase auth cookies; fan sessions (fc_fan) are untouched.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // IMPORTANT: do not run code between createServerClient and getUser().
    // This refreshes the session and persists the refreshed cookies.
    const { error } = await supabase.auth.getUser();

    // When a Supabase session cookie exists but the session is invalid
    // (expired/revoked and not refreshable), remove it so guards fail closed
    // on the next request instead of surfacing odd auth errors.
    if (error && supabaseResponse.cookies.getAll().some((c) => c.name.includes("auth-token"))) {
      for (const name of request.cookies.getAll().map((c) => c.name)) {
        if (name.includes("auth-token")) {
          request.cookies.delete(name);
          supabaseResponse.cookies.delete(name);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  // Only admin pages read the Supabase session on the server. Fan sessions use
  // the legacy fc_fan cookie and are unaffected. Route Handlers refresh their
  // own cookies during isAdminAuthed(); Server Components cannot, hence the
  // proxy scoped to admin pages is what keeps the session alive.
  matcher: ["/admin/:path*"],
};