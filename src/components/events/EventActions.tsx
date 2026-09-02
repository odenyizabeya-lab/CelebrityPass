"use client";

import React, { useState } from "react";
import { eventIcs } from "@/lib/events/helpers";

/**
 * Client-side event actions: download an .ics calendar invite and copy a share
 * link. All buttons actually work (both produce real artifacts).
 */
export default function EventActions({
  event: { name, description, venue, city, startAt, endAt, officialUrl },
  shareUrl,
}: {
  event: {
    name: string;
    description?: string | null;
    venue?: string | null;
    city?: string | null;
    startAt: string | Date;
    endAt?: string | Date | null;
    officialUrl?: string | null;
  };
  shareUrl: string;
}) {
  const downloadIcs = () => {
    const ics = eventIcs({
      name,
      description,
      location: [venue, city].filter(Boolean).join(", ") || undefined,
      startAt,
      endAt,
      url: officialUrl,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const [copied, setCopied] = useState(false);
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers.
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={downloadIcs}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5 hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add to calendar
      </button>
      <button
        onClick={copyShare}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5 hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 0a3 3 0 11-5.367 2.684 3 3 0 015.367-2.684z" />
        </svg>
        {copied ? "Link copied!" : "Share event"}
      </button>
    </div>
  );
}
