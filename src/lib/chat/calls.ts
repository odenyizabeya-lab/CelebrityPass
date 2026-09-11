// Client-side helpers + shared types for WebRTC calls. Signaling is stored in
// the DB and polled, so calls survive proxies / the SSE shim.

export type CallMode = "voice" | "video";
export type CallSignalType = "offer" | "answer" | "ice" | "cancel" | "reject" | "end";

export interface CallSignal {
  id: string;
  callId: string;
  from: "fan" | "team";
  type: CallSignalType;
  payload?: string | null;
  createdAt: string;
}

export interface ChatCall {
  id: string;
  conversationId: string;
  mode: CallMode;
  status: "RINGING" | "ACTIVE" | "ENDED" | "MISSED" | "DECLINED";
  createdBy: "fan" | "team";
  createdAt: string;
}

export async function startCall(conversationId: string, mode: CallMode, sdp: string) {
  const res = await fetch(`/api/chat/${conversationId}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, sdp }),
  });
  if (!res.ok) throw new Error("Could not start call");
  return (await res.json()) as { call: ChatCall };
}

export async function postSignal(
  conversationId: string,
  callId: string,
  input: { type: CallSignalType; payload?: string }
) {
  const res = await fetch(`/api/chat/${conversationId}/calls/${callId}/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Could not send signal");
  return (await res.json()) as { ok: boolean };
}

export async function endCall(conversationId: string, callId: string) {
  const res = await fetch(`/api/chat/${conversationId}/calls/${callId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Could not end call");
  return (await res.json()) as { ok: boolean };
}

export async function pollCalls(
  conversationId: string,
  sinceSignalId?: string | null
): Promise<{ calls: ChatCall[]; signals: CallSignal[]; latestSignalId: string | null }> {
  const q = sinceSignalId ? `?since=${encodeURIComponent(sinceSignalId)}` : "";
  const res = await fetch(`/api/chat/${conversationId}/calls${q}`);
  if (!res.ok) throw new Error("Could not fetch calls");
  const data = await res.json();
  return {
    calls: data.calls ?? [],
    signals: data.signals ?? [],
    latestSignalId: data.latestSignalId ?? null,
  };
}