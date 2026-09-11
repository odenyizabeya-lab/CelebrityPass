import type { ChatMessage } from "@prisma/client";

export type RealtimeEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "typing"; conversationId: string; senderType: "fan" | "team" }
  | { type: "read"; conversationId: string; readerType: "fan" | "team"; at: string }
  | { type: "presence"; celebrityId: string; online: boolean }
  | { type: "heartbeat" };

export type RealtimeTransport = "sse" | "websocket";

export function detectTransport(): RealtimeTransport {
  if (typeof window === "undefined") return "sse";
  try {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    if (host === "localhost" || proto === "http:") return "sse";
  } catch {}
  return "websocket";
}

export function serializeSSE(event: RealtimeEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSSELine(line: string): RealtimeEvent | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as RealtimeEvent;
  } catch {
    return null;
  }
}
