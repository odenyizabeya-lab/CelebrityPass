"use client";

import { useEffect, useState } from "react";
import { countdownLabel } from "@/lib/events/helpers";

/**
 * Live countdown to an event's start. Recomputes every second. Only meaningful
 * for upcoming events — pass a future startAt. Renders "Starts in …" text.
 */
export default function EventCountdown({
  startAt,
  className,
  compact = false,
}: {
  startAt: string | Date;
  className?: string;
  compact?: boolean;
}) {
  const get = () => countdownLabel(startAt);
  const [label, setLabel] = useState<string | null>(() => get());

  useEffect(() => {
    const timer = setInterval(() => {
      setLabel(get());
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt]);

  if (!label) return null;
  if (compact) {
    // Compact: show only the leftmost meaningful unit, e.g. "12d" or "04:32:18"
    const compactLabel = label.replace("Starts in ", "");
    return (
      <span className={className}>
        <span className="opacity-70">Starts in </span>
        {compactLabel}
      </span>
    );
  }
  return <span className={className}>{label}</span>;
}
