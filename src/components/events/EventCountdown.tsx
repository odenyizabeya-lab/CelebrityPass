"use client";

import { useEffect, useState } from "react";
import { countdownTo } from "@/lib/events/helpers";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * Live countdown to an event's start. Recomputes every second. Only meaningful
 * for upcoming events — pass a future startAt. Renders "Starts in …" text with
 * locale-aware labels.
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
  const { t } = useLanguage();

  const build = () => {
    const c = countdownTo(startAt);
    if (!c) return null;
    if (c.days >= 1) {
      const d = c.days === 1 ? t("events.countdown1Day") : t("events.countdownDays", { n: String(c.days) });
      const h = c.hours > 0 ? t("events.countdownHours", { n: String(c.hours) }) : "";
      return `${d}${h}`;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
  };

  const [label, setLabel] = useState<string | null>(() => build());

  useEffect(() => {
    const timer = setInterval(() => {
      setLabel(build());
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt]);

  const prefix = t("events.startsIn");
  const display = label === null ? null : `${prefix}${label}`;
  if (!display) return null;
  if (compact) {
    // Compact: drop the prefix, show only the leftmost meaningful unit.
    return (
      <span className={className}>
        <span className="opacity-70">{prefix}</span>
        {label}
      </span>
    );
  }
  return <span className={className}>{display}</span>;
}