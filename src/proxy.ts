import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, FAN_COOKIE } from "@/lib/session-token";
import { classifyRoute, isNativeUserAgent, sanitizeNext, POST_LOGIN_DEFAULT } from "@/lib/routes";

/**
 * Request-time authentication gate.
 *
 * Runs before any page renders, so a protected screen is never produced — not
 * even briefly — for an anonymous visitor. The policy itself lives in
 * `@/lib/routes` so this file and the server components can never disagree.
 *
 * This check is deliberately cookie-only (no database): it has to run on every
 * request at the edge. The deeper "does this fan still exist and is the account
 * active?" check lives in `@/lib/session`, which pages call before rendering
 * personalised content.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // A valid, unexpired, correctly signed session unlocks everything.
  if (verifySessionToken(request.cookies.get(FAN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const isNative = isNativeUserAgent(request.headers.get("user-agent"));
  const decision = classifyRoute(pathname, isNative);

  if (decision !== "protected") {
    return NextResponse.next();
  }

  // An unauthenticated visitor asked for a protected page: send them to the
  // auth screen, remembering where they were heading.
  const loginUrl = new URL("/login", request.url);
  const next = sanitizeNext(pathname + search);
  loginUrl.searchParams.set("next", next ?? POST_LOGIN_DEFAULT);

  // A session cookie was present but rejected (expired, tampered with, or
  // signed with a rotated secret). Say so, so the auth screen can show "Your
  // session has expired. Please log in again to continue." instead of a
  // generic greeting, and clear it so the browser stops resending it — which
  // is what used to leave people stuck in a login loop.
  if (request.cookies.has(FAN_COOKIE)) {
    loginUrl.searchParams.set("reason", "expired");
  }

  const response = NextResponse.redirect(loginUrl);
  if (request.cookies.has(FAN_COOKIE)) {
    response.cookies.delete(FAN_COOKIE);
  }

  return response;
}
