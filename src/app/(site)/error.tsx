"use client";

import RecoveryPanel from "@/components/RecoveryPanel";

export default function SiteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Renders inside the (site) layout shell, so the app header/footer stay up.
  return (
    <div className="flex flex-1 flex-col">
      <RecoveryPanel onRetry={() => reset()} />
    </div>
  );
}