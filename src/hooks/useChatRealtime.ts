"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RealtimeMessage {
  id: string;
  conversationId: string;
  senderType: "fan" | "team" | "system";
  fanId: string | null;
  teamEmail: string | null;
  clientId: string;
  type: string;
  body: string;
  attachmentJson: string | null;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
  repliedToId: string | null;
  repliedTo: { id: string; senderType: string; type: string; body: string; deletedAt: string | null } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface ChatRealtimeHandlers {
  onMessage?: (message: RealtimeMessage) => void;
  onTyping?: (event: {
    conversationId: string;
    senderType: "fan" | "team";
  }) => void;
  onRead?: (event: {
    conversationId: string;
    messageId?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
  }) => void;
  onPresence?: (online: boolean) => void;
}

export function useChatRealtime(
  conversationId: string | null,
  since?: string | Date | null,
  handlers: ChatRealtimeHandlers = {},
) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(handlers.onMessage);
  const onTypingRef = useRef(handlers.onTyping);
  const onReadRef = useRef(handlers.onRead);
  const onPresenceRef = useRef(handlers.onPresence);

  useEffect(() => { onMessageRef.current = handlers.onMessage; }, [handlers.onMessage]);
  useEffect(() => { onTypingRef.current = handlers.onTyping; }, [handlers.onTyping]);
  useEffect(() => { onReadRef.current = handlers.onRead; }, [handlers.onRead]);
  useEffect(() => { onPresenceRef.current = handlers.onPresence; }, [handlers.onPresence]);

  const sinceIso =
    since instanceof Date
      ? since.toISOString()
      : typeof since === "string"
        ? since
        : null;

  useEffect(() => {
    if (!conversationId) return;

    const params = new URLSearchParams({ conversationId });
    if (sinceIso) params.set("since", sinceIso);

    let retries = 0;
    let es: EventSource | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      es = new EventSource(`/api/chat/events?${params}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retries = 0;
      };

      es.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as { type: string } & Record<string, unknown>;
          setLastEvent(event);
          switch (event.type) {
            case "message":
              onMessageRef.current?.(
                event.message as unknown as RealtimeMessage,
              );
              break;
            case "typing":
              onTypingRef.current?.({
                conversationId: event.conversationId as string,
                senderType: event.senderType as "fan" | "team",
              });
              break;
            case "read":
              onReadRef.current?.({
                conversationId: event.conversationId as string,
                messageId: event.messageId as string | null | undefined,
                deliveredAt: event.deliveredAt as string | null | undefined,
                readAt: event.at as string | null | undefined,
              });
              break;
            case "presence":
              onPresenceRef.current?.(event.online as boolean);
              break;
          }
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        eventSourceRef.current = null;
        retries++;
        const delay = Math.min(1000 * 2 ** retries, 30000);
        setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [conversationId, sinceIso]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  }, []);

  return { connected, lastEvent, disconnect };
}