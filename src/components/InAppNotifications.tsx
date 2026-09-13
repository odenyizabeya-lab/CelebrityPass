"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

interface IncomingNotification {
  type: "incoming";
  conversationId: string;
  messageId: string;
  preview: string;
  createdAt: string;
  celebrity: { id: string; slug: string; name: string; profileImageUrl: string | null };
}

interface Toast {
  key: string;
  conversationId: string;
  messageId: string;
  name: string;
  slug: string;
  preview: string;
  profileImageUrl: string | null;
}

// How many toasts can stack; a flurry from the same chat collapses into one.
const MAX_TOASTS = 2;
const AUTO_DISMISS_MS = 6000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 30_000;
const AUTH_RETRY_MS = 45_000;
const CONNECT_TIMEOUT_MS = 10_000;
const WATCHDOG_MS = 10_000;
const IDLE_DEAD_MS = 50_000;

function Avatar({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <Image
        src={url}
        alt={name}
        width={48}
        height={48}
        unoptimized
        onError={() => setBroken(true)}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/10"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#202c33] text-base font-black text-white ring-2 ring-white/10">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function InAppNotifications() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((key: string) => {
    const timer = timersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const openChat = useCallback(
    (conversationId: string, key: string) => {
      dismiss(key);
      window.dispatchEvent(new CustomEvent("chat:unread-changed"));
      router.push(`/chat/${conversationId}`);
    },
    [dismiss, router],
  );

  const pushToast = useCallback(
    (event: IncomingNotification) => {
      // Already reading exactly this conversation — the room shows it live, so
      // a banner on top of the same message would just be noise.
      const path = pathnameRef.current ?? "";
      if (
        path === `/chat/${event.conversationId}` ||
        path.startsWith(`/chat/${event.conversationId}/`)
      ) {
        return;
      }
      // App is backgrounded — no screen to show, the phone push covers it.
      if (typeof document !== "undefined" && document.hidden) return;
      if (seenRef.current.has(event.messageId)) return;
      seenRef.current.add(event.messageId);

      const toast: Toast = {
        key: event.messageId,
        conversationId: event.conversationId,
        messageId: event.messageId,
        name: event.celebrity.name,
        slug: event.celebrity.slug,
        preview: event.preview || "New message",
        profileImageUrl: event.celebrity.profileImageUrl,
      };

      setToasts((prev) => {
        // Replace a fresher toast for the same conversation with this newest
        // one (older timer cleared), then keep the newest MAX_TOASTS overall.
        const keep = prev.filter((t) => t.conversationId !== event.conversationId);
        for (const t of keep) {
          const timer = timersRef.current.get(t.key);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.key);
          }
        }
        const next = [toast, ...keep].slice(0, MAX_TOASTS);
        const timer = setTimeout(() => dismiss(toast.key), AUTO_DISMISS_MS);
        timersRef.current.set(toast.key, timer);
        return next;
      });

      window.dispatchEvent(new CustomEvent("chat:unread-changed"));
    },
    [dismiss],
  );
  const pushToastRef = useRef(pushToast);
  useEffect(() => {
    pushToastRef.current = pushToast;
  }, [pushToast]);

  // Resilient SSE stream — same backoff/watchdog strategy as the chat rooms so
  // banners survive network blips, app resumes and proxy timeouts.
  useEffect(() => {
    let disposed = false;
    let gen = 0;
    let retries = 0;
    let active = false;
    let authRetry = false;
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
        try {
          controller.abort();
        } catch {}
        controller = null;
      }
      active = false;
    }

    function backoff() {
      const base = Math.min(BACKOFF_BASE_MS * 2 ** retries, BACKOFF_MAX_MS);
      retries += 1;
      return base + Math.floor(Math.random() * base * 0.3);
    }

    function schedule(ms: number) {
      if (disposed) return;
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed && !active) connect();
      }, ms);
    }

    function handleEvent(raw: unknown) {
      const event = raw as { type: string } & Record<string, unknown>;
      if (!event || typeof event.type !== "string") return;
      lastEventAt = Date.now();
      retries = 0;
      if (event.type === "disabled") {
        // Fan turned chat notifications off — stop quietly until they reload.
        killCurrent();
        authRetry = true;
        return;
      }
      if (event.type === "incoming") {
        pushToastRef.current(event as unknown as IncomingNotification);
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
        if (disposed || myGen !== gen) return;
        killCurrent();
        schedule(500 + Math.random() * 1000);
      } catch {
        if (disposed || myGen !== gen) return;
        killCurrent();
        schedule(backoff());
      }
    }

    function connect() {
      if (disposed || active) return;
      const myGen = ++gen;
      active = true;
      const ctrl = new AbortController();
      controller = ctrl;

      headerTimeout = setTimeout(() => {
        if (myGen === gen && active) {
          try {
            ctrl.abort();
          } catch {}
        }
      }, CONNECT_TIMEOUT_MS);

      fetch("/api/chat/fan-notifications", {
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
            // Not signed in / session expired — retry slowly in case the fan
            // logs in again in this tab (a full reload would reboot it anyway).
            killCurrent();
            authRetry = true;
            schedule(AUTH_RETRY_MS);
            return;
          }
          if (!res.ok || !res.body) {
            killCurrent();
            schedule(res.status < 500 ? 1500 : backoff());
            return;
          }
          lastEventAt = Date.now();
          void pump(res.body.getReader(), myGen);
        })
        .catch((err: unknown) => {
          if (disposed || myGen !== gen) return;
          const aborted = err instanceof DOMException && err.name === "AbortError";
          killCurrent();
          schedule(aborted ? 1500 : backoff());
        });
    }

    connect();

    const watchdog = setInterval(() => {
      if (disposed || !active) return;
      if (Date.now() - lastEventAt > IDLE_DEAD_MS) {
        killCurrent();
        schedule(500 + Math.random() * 1000);
      }
    }, WATCHDOG_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(new CustomEvent("chat:unread-changed"));
      // Coming back from an auth-denied state (login in another tab, etc.).
      if (authRetry) {
        authRetry = false;
        clearReconnectTimer();
        if (!disposed && !active) connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      if (headerTimeout) clearTimeout(headerTimeout);
      clearReconnectTimer();
      killCurrent();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-2 top-2 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[400px]">
      {toasts.map((t) => (
        <div
          key={t.key}
          role="button"
          tabIndex={0}
          aria-label={`Open chat with ${t.name}`}
          onClick={() => openChat(t.conversationId, t.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openChat(t.conversationId, t.key);
            }
          }}
          className="inapp-toast pointer-events-auto flex cursor-pointer items-center gap-3 rounded-2xl bg-[#111b21]/95 p-3 text-left shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition hover:ring-white/25"
        >
          <Avatar name={t.name} url={t.profileImageUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-white">{t.name}</p>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#00a884]">
                Reply
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-400">{t.preview}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.key);
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}