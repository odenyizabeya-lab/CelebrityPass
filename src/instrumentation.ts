// Global process guards: a single failed/lingering DB-adjacent promise must
// never take the whole HTTP server down. Next invokes `register` once at
// server start (src/ folder convention — instrumentation.ts sits next to
// layout.tsx's folder root).
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[guard] unhandledRejection:", reason instanceof Error ? reason.stack ?? reason.message : reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[guard] uncaughtException:", err.stack ?? err.message);
    });
  }
}