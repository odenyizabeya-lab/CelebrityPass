"use client";

import { useEffect, useRef, useState } from "react";
import { useChatCall } from "@/hooks/useChatCall";

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

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export default function CallOverlay({
  conversationId,
  open,
  mode,
  contactName,
  contactAvatar,
  onClose,
}: {
  conversationId: string;
  open: boolean;
  mode: "voice" | "video";
  contactName: string;
  contactAvatar?: string | null;
  onClose: () => void;
}) {
  const {
    phase,
    mode: callMode,
    localStream,
    remoteStream,
    error,
    elapsed,
    start,
    hangUp,
  } = useChatCall({ conversationId, side: "fan" });

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      closedRef.current = false;
      setMicOn(true);
      setCamOn(true);
      void start(mode);
    }
    if (!open && startedRef.current) {
      startedRef.current = false;
    }
  }, [open, mode, start]);

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
    if (micOn && localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = true));
    }
    if (!micOn && localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = false));
    }
  }, [micOn, localStream]);

  useEffect(() => {
    if (camOn && localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = true));
    }
    if (!camOn && localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = false));
    }
  }, [camOn, localStream]);

  // When the call finishes (peer ended / error / explicit hangup), close the overlay.
  useEffect(() => {
    if ((phase === "ended" || error) && open && !closedRef.current) {
      closedRef.current = true;
      const t = setTimeout(() => onClose(), error ? 2200 : 800);
      return () => clearTimeout(t);
    }
  }, [phase, error, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hangUp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hangUp]);

  if (!open) return null;

  const dialing = phase === "dialing" || phase === "connecting";
  const active = phase === "active";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-ink-950 px-6">
      <button
        onClick={() => void hangUp()}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close call"
      >
        ×
      </button>

      {error ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold text-red-400">{error}</p>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 px-6 py-2.5 text-sm text-white hover:bg-white/20"
          >
            Back to chat
          </button>
        </div>
      ) : active && callMode === "video" ? (
        <div className="flex h-full w-full flex-col items-center gap-3 py-8">
          <div className="relative min-h-0 w-full max-w-3xl flex-1 overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
            {!remoteStream && (
              <div className="absolute inset-0 grid place-items-center">
                <Avatar name={contactName} src={contactAvatar} />
              </div>
            )}
          </div>
          <div className="absolute bottom-32 right-4 h-36 w-28 overflow-hidden rounded-xl border border-white/20 bg-ink-800 sm:bottom-36">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <Avatar name={contactName} src={contactAvatar} />
            <p className="text-xl font-bold text-white">{contactName}</p>
            <p className="text-sm text-zinc-400">
              {active
                ? fmt(elapsed)
                : callMode === "video"
                ? "Connecting video call…"
                : "Calling…"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-6">
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

        {callMode === "video" && (
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

      {dialing && (
        <div className="absolute bottom-24 flex gap-6">
          <button
            onClick={() => void hangUp()}
            className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-xl text-white shadow-lg transition hover:bg-red-600"
            aria-label="Cancel call"
          >
            📵
          </button>
        </div>
      )}
    </div>
  );
}