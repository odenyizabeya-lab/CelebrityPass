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
    readerType?: "fan" | "team";
    messageId?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
  }) => void;
  onPresence?: (online: boolean) => void;
  /** Auth expired mid-session (401) — the hook stops retrying and calls this. */
  onAuthExpired?: () => void;
}

// Start with 500ms, double per attempt, cap at 30s (+ up to 30% jitter) so a
// genuinely unreachable server doesn't hammer itself, but short hiccups heal fast.
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 30_000;
// Give up on a connection that produces no headers within 10s.
const CONNECT_TIMEOUT_MS = 10_000;
// The server heartbeats every 20s. If nothing has arrived for 50s the stream is
// silently dead (NAT/proxy/carrier killed it) — heal it quietly in the background.
const WATCHDOG_MS = 10_000;
const IDLE_DEAD_MS = 50_000;

interface Lifecycle {
  disconnect: () => void;
  reconnect: () => void;
}

export function useChatRealtime(
  conversationId: string | null,
  since?: string | Date | null,
  handlers: ChatRealtimeHandlers = {},
) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(null);
  const onMessageRef = useRef(handlers.onMessage);
  const onTypingRef = useRef(handlers.onTyping);
  const onReadRef = useRef(handlers.onRead);
  const onPresenceRef = useRef(handlers.onPresence);
  const onAuthExpiredRef = useRef(handlers.onAuthExpired);

  useEffect(() => { onMessageRef.current = handlers.onMessage; }, [handlers.onMessage]);
  useEffect(() => { onTypingRef.current = handlers.onTyping; }, [handlers.onTyping]);
  useEffect(() => { onReadRef.current = handlers.onRead; }, [handlers.onRead]);
  useEffect(() => { onPresenceRef.current = handlers.onPresence; }, [handlers.onPresence]);
  useEffect(() => { onAuthExpiredRef.current = handlers.onAuthExpired; }, [handlers.onAuthExpired]);

  const sinceIso =
    since instanceof Date
      ? since.toISOString()
      : typeof since === "string"
        ? since
        : null;

  // `since` is a moving cursor (ChatRoom advances it on every message). It must
  // only be used when (re)establishing a connection — advancing it must NEVER
  // tear down a healthy stream, otherwise every message would flash
  // "Reconnecting…" and open a brand-new connection.
  const sinceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sinceIso) return;
    if (!sinceRef.current || sinceIso > sinceRef.current) sinceRef.current = sinceIso;
  }, [sinceIso]);

  const lifecycleRef = useRef<Lifecycle>({ disconnect: () => {}, reconnect: () => {} });

  useEffect(() => {
    if (!conversationId) return;
    const convId = conversationId;

    let disposed = false;
    let gen = 0; // generation counter — any result from an older generation is dropped
    let retries = 0;
    let active = false;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let headerTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastEventAt = Date.now();

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function killCurrent() {
      gen += 1;
      if (controller) {
        try { controller.abort(); } catch {}
        controller = null;
      }
      active = false;
    }

    function backoffDelay() {
      retries += 1;
      const base = Math.min(BACKOFF_BASE_MS * 2 ** (retries - 1), BACKOFF_MAX_MS);
      return base + Math.floor(Math.random() * base * 0.3);
    }

    function scheduleReconnect(clean: boolean) {
      if (disposed) return;
      clearReconnectTimer();
      // A clean/planned server-side close (heartbeats still flowing until the
      // end) is not a failure — reopen quickly. A hard error uses backoff.
      const delay = clean ? 500 + Math.random() * 1000 : backoffDelay();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed && !active) connect();
      }, delay);
    }

    function handleEvent(raw: unknown) {
      const event = raw as { type: string } & Record<string, unknown>;
      if (!event || typeof event.type !== "string") return;
      lastEventAt = Date.now();
      // Any data (even a heartbeat) proves the connection is alive — reflect
      // that in the UI immediately and reset the backoff ladder.
      setConnected(true);
      retries = 0;
      setLastEvent(event);
      switch (event.type) {
        case "message":
          onMessageRef.current?.(event.message as unknown as RealtimeMessage);
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
            readerType: event.readerType as "fan" | "team" | undefined,
            messageId: event.messageId as string | null | undefined,
            deliveredAt: event.deliveredAt as string | null | undefined,
            readAt: event.at as string | null | undefined,
          });
          break;
        case "presence":
          onPresenceRef.current?.(event.online as boolean);
          break;
      }
    }

    async function pump(reader: ReadableStreamDefaultReader<Uint8Array>, myGen: number) {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (disposed || myGen !== gen) return;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of block.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                handleEvent(JSON.parse(line.slice(6)));
              } catch {}
            }
          }
          lastEventAt = Date.now();
        }
        // Clean EOF: the server closed the stream deliberately (planned cycle).
        // This is not a failure — reopen quickly without flashing a banner.
        if (disposed || myGen !== gen) return;
        killCurrent();
        scheduleReconnect(true);
      } catch {
        if (disposed || myGen !== gen) return;
        setConnected(false);
        killCurrent();
        scheduleReconnect(false);
      }
    }

    function connect() {
      if (disposed || active) return;
      const myGen = ++gen;
      active = true;
      const params = new URLSearchParams({ conversationId: convId });
      const sinceVal = sinceRef.current;
      if (sinceVal) params.set("since", sinceVal);
      const ctrl = new AbortController();
      controller = ctrl;

      headerTimeout = setTimeout(() => {
        if (myGen === gen && active) {
          try { ctrl.abort(); } catch {}
        }
      }, CONNECT_TIMEOUT_MS);

      fetch(`/api/chat/events?${params.toString()}`, {
        signal: ctrl.signal,
        cache: "no-store",
      })
        .then((res) => {
          if (disposed || myGen !== gen) return;
          if (headerTimeout) {
            clearTimeout(headerTimeout);
            headerTimeout = null;
          }
          if (res.status === 401) {
            // Cookie expired mid-session — EventSource would retry forever here.
            // Stop trying and let the host redirect to login.
            setConnected(false);
            killCurrent();
            onAuthExpiredRef.current?.();
            return;
          }
          if (!res.ok || !res.body) {
            setConnected(false);
            killCurrent();
            scheduleReconnect(res.status < 500);
            return;
          }
          lastEventAt = Date.now();
          void pump(res.body.getReader(), myGen);
        })
        .catch((err: unknown) => {
          if (disposed || myGen !== gen) return;
          const aborted = err instanceof DOMException && err.name === "AbortError";
          setConnected(false);
          killCurrent();
          scheduleReconnect(aborted);
        });
    }

    connect();

    // Watchdog: if the stream stays silent for IDLE_DEAD_MS (the server sends a
    // heartbeat every 20s), it was killed by a proxy/carrier without an error
    // event. Heal it quietly — the banner only appears if the replacement fails.
    const watchdog = setInterval(() => {
      if (disposed || !active) return;
      if (Date.now() - lastEventAt > IDLE_DEAD_MS) {
        killCurrent();
        scheduleReconnect(true);
      }
    }, WATCHDOG_MS);

    lifecycleRef.current = {
      disconnect: () => {
        killCurrent();
        clearReconnectTimer();
        setConnected(false);
      },
      reconnect: () => {
        clearReconnectTimer();
        killCurrent();
        if (!disposed) connect();
      },
    };

    return () => {
      disposed = true;
      clearInterval(watchdog);
      if (headerTimeout) clearTimeout(headerTimeout);
      clearReconnectTimer();
      killCurrent();
      setConnected(false);
      lifecycleRef.current = { disconnect: () => {}, reconnect: () => {} };
    };
  }, [conversationId]);

  const disconnect = useCallback(() => lifecycleRef.current.disconnect(), []);
  const reconnect = useCallback(() => lifecycleRef.current.reconnect(), []);

  return { connected, lastEvent, disconnect, reconnect };
}