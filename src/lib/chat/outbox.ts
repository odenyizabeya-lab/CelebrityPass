"use client";

/**
 * App-wide offline outbox.
 *
 * The in-page ChatRoom flushes its own queued messages, but only while the
 * conversation is open. If the user sent something, then left the app and came
 * back later while the network was down, the queued send would sit in
 * localStorage forever. This module scans EVERY cached conversation's message
 * list and re-POSTs any fan send that was accepted locally (PENDING/FAILED,
 * temp- id) but never acknowledged.
 *
 * The server's (conversationId, clientId) unique constraint makes retries
 * idempotent, so a re-send can never create a duplicate row on the wire.
 */

import {
  readCachedMessageLists,
  writeMessagesCache,
} from "./local-cache";

const inFlight = new Set<string>();
let running = false;

interface QueuedCandidate {
  conversationId: string;
  message: Record<string, unknown>;
}

function isQueuedCandidate(raw: unknown): raw is QueuedCandidate {
  if (!raw || typeof raw !== "object") return false;
  const q = raw as Record<string, unknown>;
  const c = q.message as Record<string, unknown> | null | undefined;
  if (!c || typeof c !== "object") return false;
  return (
    typeof c.status === "string" &&
    (c.status === "PENDING" || c.status === "FAILED") &&
    typeof c.id === "string" &&
    c.id.startsWith("temp-") &&
    c.senderType === "fan" &&
    typeof c.clientId === "string"
  );
}

/** Minimal unwrap matching ChatRoom's reconcile of POST /messages responses. */
function unwrapAck(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const msg = p.message && typeof p.message === "object" ? p.message : p;
  return typeof msg === "object" ? (msg as Record<string, unknown>) : null;
}

/**
 * Re-sends every locally-queued fan message across all cached conversations.
 * Safe to call on an interval / on the `online` event / on focus.
 */
export async function flushGlobalOutbox(): Promise<void> {
  if (running || typeof navigator === "undefined") return;
  running = true;
  try {
    const lists = readCachedMessageLists();
    for (const { conversationId, messages } of lists) {
      const queued = messages
        .map((m) => ({ conversationId, message: m }))
        .filter(isQueuedCandidate);
      if (queued.length === 0) continue;

      let changed = false;
      for (const q of queued) {
        const m = q.message;
        const clientId = String(m.clientId);
        if (inFlight.has(clientId)) {
          // Covered for real by this same pass.
          continue;
        }
        // Only text or media that already has a server upload reference can be
        // re-sent without the original File bytes (which only exist while the
        // chat screen is open and they were never persisted).
        if (m.type !== "text" && !m.attachmentJson) continue;

        inFlight.add(clientId);
        try {
          let attachmentJson: unknown;
          if (m.attachmentJson) {
            try {
              attachmentJson = JSON.parse(String(m.attachmentJson));
            } catch {
              attachmentJson = String(m.attachmentJson);
            }
          }
          const res = await fetch(`/api/chat/${conversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId,
              type: m.type,
              body: String(m.body ?? ""),
              ...(attachmentJson ? { attachmentJson } : {}),
            }),
          });
          if (res.ok) {
            const ack = unwrapAck(await res.json().catch(() => null));
            const latest = readCachedMessageLists()
              .find((l) => l.conversationId === conversationId)?.messages ?? messages;
            const next = latest.map((entry) => {
              const e = entry as Record<string, unknown>;
              if (String(e.clientId ?? "") !== clientId) return entry;
              if (!ack) return { ...e, status: "SENT" };
              return { ...ack, clientId };
            });
            writeMessagesCache(conversationId, next);
            changed = true;
          }
        } catch {
          // Still queued; the next flush attempt retries it.
        } finally {
          inFlight.delete(clientId);
        }
      }
      if (changed) {
        // A subsequent flush (interval) picks up any leftovers.
      }
    }
  } finally {
    running = false;
  }
}