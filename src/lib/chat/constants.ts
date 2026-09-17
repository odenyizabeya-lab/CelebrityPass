// Shared chat constants — safe to import from both server and client code.
// Not a "use client" module so server-only logic (access gates, auto-reply)
// can require it without dragging anything browser-only into the bundle.

/** Default message fans see when a celebrity's Chat Access is OFF. */
export const CHAT_ACCESS_OFF_DEFAULT_MESSAGE =
  "Please get your CelebrityPass before chatting here.";

export const AI_MODE_AUTO = "auto";
export const AI_MODE_MANUAL = "manual";

export type AiMode = typeof AI_MODE_AUTO | typeof AI_MODE_MANUAL;