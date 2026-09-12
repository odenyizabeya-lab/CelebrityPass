"use client";

import RecoveryPanel from "@/components/RecoveryPanel";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col bg-aurora">
      <RecoveryPanel onRetry={() => reset()} />
    </div>
  );
}