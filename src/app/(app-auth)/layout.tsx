import type { ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { hasSeenWelcome } from "@/lib/session";

/**
 * Native mobile-app shell for the auth flows. Renders the splash + welcome
 * experience, then the full-bleed app-style screen (no website chrome).
 *
 * Note this reads the *welcome-seen preference*, never the auth state: the
 * splash/welcome is presentation only. Whether a request is allowed into the
 * application at all is decided by `src/proxy.ts` and `@/lib/session`.
 */
export default async function AppAuthLayout({ children }: { children: ReactNode }) {
  const [seenWelcome, native] = await Promise.all([hasSeenWelcome(), isNative()]);
  return (
    <AuthShell showWelcomeCard={!seenWelcome} isNative={native}>
      {children}
    </AuthShell>
  );
}

async function isNative(): Promise<boolean> {
  const { isNativeRequest } = await import("@/lib/session");
  return isNativeRequest();
}
