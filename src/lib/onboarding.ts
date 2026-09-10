// First-visit onboarding state for the app-opening welcome screen.
//
// The welcome experience shows at "/" until the visitor completes it, then a
// persistent httpOnly cookie remembers the choice so returning users go
// straight to the main CelebrityPass experience. Users who authenticate (login
// or register) are also marked onboarded automatically.
import { cookies } from "next/headers";

export const ONBOARDING_COOKIE = "cp_app_welcomed";

const ONBOARDING_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/** True when this visitor has completed (or skipped) the welcome experience. */
export async function isOnboarded(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ONBOARDING_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

/** Persist the onboarding-complete state on this visitor's browser. */
export async function markOnboarded(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ONBOARDING_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONBOARDING_MAX_AGE,
    });
  } catch {
    // Setting the cookie must never break an otherwise-successful request.
  }
}