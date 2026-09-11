"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startCall,
  postSignal,
  endCall,
  pollCalls,
  type CallMode,
  type ChatCall,
} from "@/lib/chat/calls";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export type CallPhase = "idle" | "dialing" | "ringing" | "connecting" | "active" | "ended";

interface Options {
  conversationId: string;
  side: "fan" | "team";
  onCallEnded?: () => void;
  onSignal?: (type: string) => void;
}

function getMedia(mode: CallMode): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return Promise.reject(new Error("media unavailable"));
  }
  return navigator.mediaDevices.getUserMedia(
    mode === "video"
      ? { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { video: false, audio: true }
  );
}

export function useChatCall({ conversationId, side, onCallEnded }: Options) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [incoming, setIncoming] = useState<ChatCall | null>(null);
  const [mode, setMode] = useState<CallMode>("voice");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sinceSignalRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mySideRef = useRef(side);
  const modeRef = useRef(mode);

  useEffect(() => {
    mySideRef.current = side;
  }, [side]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const cleanupLocal = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  const teardown = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    cleanupLocal();
    setRemoteStream(null);
    callIdRef.current = null;
    sinceSignalRef.current = null;
    setElapsed(0);
    setError(null);
  }, [cleanupLocal]);

  const buildPeer = useCallback(
    (callId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          postSignal(conversationId, callId, {
            type: "ice",
            payload: JSON.stringify(e.candidate.toJSON()),
          }).catch(() => {});
        }
      };

      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          setRemoteStream(e.streams[0]);
        } else {
          setRemoteStream(new MediaStream([e.track]));
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setPhase("active");
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
          }
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setError(pc.connectionState === "failed" ? "Call connection failed" : null);
        }
      };

      return pc;
    },
    [conversationId]
  );

  const handleRemoteSignal = useCallback((type: string, payload: string | null) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (type === "answer") {
      setPhase("connecting");
      if (payload) pc.setRemoteDescription({ type: "answer", sdp: payload }).catch(() => {});
    } else if (type === "ice") {
      if (payload) {
        try {
          pc.addIceCandidate(JSON.parse(payload)).catch(() => {});
        } catch {}
      }
    } else if (type === "cancel" || type === "reject" || type === "end") {
      setPhase("ended");
      onCallEnded?.();
    }
  }, [onCallEnded]);

  const poll = useCallback(async () => {
    try {
      const data = await pollCalls(conversationId, sinceSignalRef.current);
      // Only act on the call we're in (or the most recent RINGING for responders).
      const mine = data.calls.find((c) => c.id === callIdRef.current);
      for (const sig of data.signals) {
        if (sig.from === mySideRef.current) continue;
        handleRemoteSignal(sig.type, sig.payload ?? null);
      }
      if (data.latestSignalId) {
        sinceSignalRef.current = data.latestSignalId;
      }
      if (mine && mine.id === callIdRef.current && mine.status === "ENDED") {
        setPhase("ended");
      }
    } catch {}
  }, [conversationId, handleRemoteSignal]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void poll(), 1500);
  }, [poll]);

  const start = useCallback(async (callMode: CallMode) => {
    setError(null);
    setMode(callMode);
    try {
      const stream = await getMedia(callMode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate && callIdRef.current) {
          postSignal(conversationId, callIdRef.current, {
            type: "ice",
            payload: JSON.stringify(e.candidate.toJSON()),
          }).catch(() => {});
        }
      };
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
        else setRemoteStream(new MediaStream([e.track]));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setPhase("active");
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
          }
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setError(pc.connectionState === "failed" ? "Call connection failed" : null);
        }
      };

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { call } = await startCall(conversationId, callMode, offer.sdp ?? "");
      callIdRef.current = call.id;
      setPhase("dialing");
      startPolling();
    } catch (e) {
      setError((e as Error)?.message ?? "Could not start call");
      setPhase("ended");
      cleanupLocal();
    }
  }, [conversationId, startPolling, cleanupLocal]);

  const answer = useCallback(async (call: ChatCall) => {
    setError(null);
    setMode(call.mode);
    callIdRef.current = call.id;
    setPhase("connecting");
    try {
      const stream = await getMedia(call.mode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = buildPeer(call.id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offerSig = await pollCalls(conversationId, null);
      const offer = offerSig.signals.find((s) => s.callId === call.id && s.type === "offer");
      if (offer?.payload) {
        await pc.setRemoteDescription({ type: "offer", sdp: offer.payload });
      } else {
        throw new Error("Offer not found for call");
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await postSignal(conversationId, call.id, {
        type: "answer",
        payload: answer.sdp ?? "",
      });
      sinceSignalRef.current = offerSig.latestSignalId;
      startPolling();
    } catch (e) {
      setError((e as Error)?.message ?? "Could not answer call");
      setPhase("ended");
      cleanupLocal();
    }
  }, [conversationId, buildPeer, startPolling, cleanupLocal]);

  const decline = useCallback(async (call: ChatCall) => {
    try {
      await postSignal(conversationId, call.id, { type: "reject" });
    } catch {}
    setIncoming(null);
    setPhase("ended");
  }, [conversationId]);

  const hangUp = useCallback(async () => {
    const callId = callIdRef.current;
    setPhase("ended");
    if (callId) {
      try { await postSignal(conversationId, callId, { type: "end" }); } catch {}
      try { await endCall(conversationId, callId); } catch {}
    }
    teardown();
    onCallEnded?.();
  }, [conversationId, teardown, onCallEnded]);

  // Watch for incoming RINGING calls (responder side / admin).
  const watch = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await pollCalls(conversationId, null);
        const ringing = data.calls.find(
          (c) => c.status === "RINGING" && c.createdBy !== mySideRef.current && c.createdAt
        );
        if (ringing && !callIdRef.current) {
          setIncoming(ringing);
          callIdRef.current = ringing.id;
        }
      } catch {}
    }, 1500);
  }, [conversationId]);

  const stopWatch = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    return () => {
      teardown();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [teardown]);

  return {
    phase,
    incoming,
    mode,
    localStream,
    remoteStream,
    error,
    elapsed,
    start,
    answer,
    decline,
    hangUp,
    watch,
    stopWatch,
  };
}