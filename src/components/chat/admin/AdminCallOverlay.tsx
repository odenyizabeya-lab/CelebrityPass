"use client";

import { useEffect, useRef, useState } from "react";
import { useChatCall } from "@/hooks/useChatCall";

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export default function AdminCallOverlay({
  conversationId,
  fanName,
  onClosed,
}: {
  conversationId: string;
  fanName: string;
  onClosed: () => void;
}) {
  const {
    phase,
    incoming,
    mode,
    localStream,
    remoteStream,
    error,
    elapsed,
    answer,
    decline,
    hangUp,
    watch,
    stopWatch,
  } = useChatCall({ conversationId, side: "team", onCallEnded: onClosed });

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(false);

  // Start watching for incoming calls when mounted.
  useEffect(() => {
    if (!watchedRef.current) {
      watchedRef.current = true;
      watch();
    }
    return () => stopWatch();
  }, [watch, stopWatch]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    }
  }, [micOn, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
    }
  }, [camOn, localStream]);

  const active = phase === "active";
  const connecting = phase === "dialing" || phase === "connecting";

  if (phase === "ended") {
    return null;
  }

  // Incoming call ring.
  if (incoming && phase === "idle") {
    return (
      <div className="fixed inset-x-0 bottom-24 z-[75] mx-auto w-full max-w-md px-4">
        <div className="rounded-3xl border border-white/10 bg-ink-800/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-600 to-accent-500 text-2xl font-bold text-white">
              {fanName.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-white">{fanName}</p>
              <p className="text-sm text-zinc-400">
                Incoming {incoming.mode === "video" ? "video" : "voice"} call…
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={() => void decline(incoming)}
              className="grid h-12 w-12 place-items-center rounded-full bg-red-500 text-xl font-bold text-white shadow-lg transition hover:bg-red-600"
              aria-label="Decline call"
              title="Decline"
            >
              📵
            </button>
            <button
              onClick={() => void answer(incoming)}
              className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-xl font-bold text-white shadow-lg transition hover:bg-emerald-600"
              aria-label="Accept call"
              title="Accept"
            >
              📞
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active / connecting call.
  return (
    <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-ink-950/95 px-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {active && mode === "video" ? (
        <div className="relative min-h-0 w-full max-w-3xl flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
          {!remoteStream && (
            <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
              Waiting for video…
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-primary-600 to-accent-500 text-4xl font-bold text-white">
            {fanName.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <p className="text-lg font-bold text-white">{fanName}</p>
          <p className="text-sm text-zinc-400">
            {active ? fmt(elapsed) : connecting ? "Connecting…" : mode === "video" ? "Video call" : "Voice call"}
          </p>
        </div>
      )}

      <div className="absolute bottom-16 w-full max-w-3xl px-6">
        {mode === "video" && active && (
          <div className="absolute bottom-0 right-6 h-40 w-28 overflow-hidden rounded-xl border border-white/20 bg-ink-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setMicOn((v) => !v)}
            disabled={!active}
            className={`grid h-12 w-12 place-items-center rounded-full text-lg transition disabled:opacity-30 ${
              micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
            }`}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {micOn ? "🎙" : "🔇"}
          </button>

          <button
            onClick={() => void hangUp()}
            className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-xl font-bold text-white shadow-lg transition hover:bg-red-600"
            aria-label="End call"
          >
            📞
          </button>

          {mode === "video" && (
            <button
              onClick={() => setCamOn((v) => !v)}
              disabled={!active}
              className={`grid h-12 w-12 place-items-center rounded-full text-lg transition disabled:opacity-30 ${
                camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
              }`}
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            >
              {camOn ? "📹" : "📷"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}