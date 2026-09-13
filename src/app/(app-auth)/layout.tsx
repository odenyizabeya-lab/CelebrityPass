import type { ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { isOnboarded } from "@/lib/onboarding";

/**
 * Native mobile-app shell for the auth flows. Renders the splash + welcome
 * experience, then the full-bleed app-style screen (no website chrome).
 */
export default async function AppAuthLayout({ children }: { children: ReactNode }) {
  let onboarded = false;
  try {
    onboarded = await isOnboarded();
  } catch {
    onboarded = false;
  }
  return <AuthShell onboarded={onboarded}>{children}</AuthShell>;
}