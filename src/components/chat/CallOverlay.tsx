"use client";

import { useEffect, useRef, useState } from "react";

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (!src) {
    return (
      <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-primary-600 to-accent-500 text-4xl font-bold text-white">
        {name?.charAt(0)?.toUpperCase() ?? "?"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-28 w-28 rounded-full object-cover ring-2 ring-white/10" />
  );
}

export default function CallOverlay({
  open,
  mode,
  contactName,
  contactAvatar,
  onAccept,
  onReject,
  onEnd,
}: {
  open: boolean;
  mode: "voice" | "video";
  contactName: string;
  contactAvatar?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onReject();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onReject]);

  if (!open) return null;

  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-ink-950 px-6">
      <button
        onClick={onReject}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close call"
      >
        ×
      </button>

      <div className="mb-8 flex flex-col items-center gap-4">
        <Avatar name={contactName} src={contactAvatar} />
        <p className="text-xl font-bold text-white">{contactName}</p>
        <p className="text-sm text-zinc-400">
          {seconds === 0
            ? mode === "video"
              ? "Starting video call..."
              : "Calling..."
            : elapsed}
        </p>
      </div>

      {mode === "video" && (
        <div className="mb-6 h-48 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-700 sm:h-56 sm:w-40">
          {camOn ? (
            <div className="grid h-full w-full place-items-center text-xs text-zinc-500">
              Camera preview
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-600 text-sm font-bold text-white">
                You
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-6">
        <button
          onClick={() => setMicOn((v) => !v)}
          className={`grid h-12 w-12 place-items-center rounded-full text-lg transition ${
            micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
          }`}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? "🎙" : "🔇"}
        </button>

        <button
          onClick={onEnd}
          className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-xl font-bold text-white shadow-lg transition hover:bg-red-600"
          aria-label="End call"
        >
          📞
        </button>

        {mode === "video" && (
          <button
            onClick={() => setCamOn((v) => !v)}
            className={`grid h-12 w-12 place-items-center rounded-full text-lg transition ${
              camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
            }`}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          >
            {camOn ? "📹" : "📷"}
          </button>
        )}
      </div>

      {seconds === 0 && (
        <div className="absolute bottom-24 flex gap-6">
          <button
            onClick={onAccept}
            className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-xl text-white shadow-lg transition hover:bg-emerald-600"
            aria-label="Accept call"
          >
            📞
          </button>
          <button
            onClick={onReject}
            className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-xl text-white shadow-lg transition hover:bg-red-600"
            aria-label="Reject call"
          >
            📵
          </button>
        </div>
      )}
    </div>
  );
}