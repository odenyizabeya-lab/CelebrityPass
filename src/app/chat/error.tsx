"use client";

import RecoveryPanel from "@/components/RecoveryPanel";

export default function ChatError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Renders inside the full-viewport chat shell (h-dvh, fixed layout).
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-aurora">
      <RecoveryPanel onRetry={() => reset()} compact />
    </div>
  );
}