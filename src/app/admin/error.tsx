"use client";

import RecoveryPanel from "@/components/RecoveryPanel";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Renders inside the admin layout shell, keeping the admin nav visible.
  return (
    <div className="flex flex-col">
      <RecoveryPanel onRetry={() => reset()} compact />
    </div>
  );
}