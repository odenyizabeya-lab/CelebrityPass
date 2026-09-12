"use client";

/**
 * fetch() with a guaranteed ceiling time so a dead/slow network can never hang
 * a form button or search input forever. Combines an internal abort timer with
 * any caller-supplied signal.
 */
export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export function fetchWithTimeout(
  url: string,
  init: FetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 20_000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(url, { ...rest, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}