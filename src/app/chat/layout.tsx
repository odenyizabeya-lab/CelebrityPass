import type { Viewport } from "next";
import GlobalOutboxFlusher from "@/components/chat/GlobalOutboxFlusher";

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  // When the Android keyboard opens, the layout viewport resizes to the
  // remaining space so the fixed composer stays directly above the keyboard
  // instead of being pushed up or covered.
  interactiveWidget: "resizes-content",
};

/**
 * Dedicated full-screen chat shell. The conversation list and chat rooms are
 * viewport-height apps: fixed header, scrollable messages, fixed composer.
 * The site header, footer and page content never appear here.
 */
export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-aurora">
      <GlobalOutboxFlusher />
      {children}
    </div>
  );
}