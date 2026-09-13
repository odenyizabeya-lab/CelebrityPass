"use client";

import { useEffect, useState } from "react";

interface ReplyTo {
  id: string;
  senderType: string;
  type: string;
  body: string;
  deletedAt: string | null;
}

interface Msg {
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
  repliedTo: ReplyTo | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface Attachment {
  bucket: string;
  key: string;
  url: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  name: string;
}

interface MessageBubbleProps {
  message: Msg;
  isOwn: boolean;
  showActions?: boolean;
  onReply?: (message: Msg) => void;
  onDelete?: (message: Msg) => void;
  onEdit?: (message: Msg, newBody: string) => void;
  onMediaClick?: (attachment: Attachment, message: Msg) => void;
  onRetrySend?: () => void;
  onDeleteLocal?: () => void;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

function parseAttachment(json: string | null): Attachment | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function StatusTicks({ status, deliveredAt, readAt }: { status: string; deliveredAt: string | null; readAt: string | null }) {
  if (status === "FAILED") {
    return (
      <span className="text-xs font-bold text-red-400" title="Couldn't send — tap Retry below">
        !
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="text-xs text-zinc-400" title="Queued — waiting to sync">
        ✓
      </span>
    );
  }
  if (readAt) {
    return (
      <span className="text-xs text-sky-400" title="Read">
        ✓✓
      </span>
    );
  }
  if (deliveredAt) {
    return (
      <span className="text-xs text-zinc-400" title="Delivered">
        ✓✓
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-400" title="Sent">
      ✓
    </span>
  );
}

function ReplyPreview({ repliedTo }: { repliedTo: ReplyTo }) {
  const label =
    repliedTo.senderType === "fan" ? "You" : repliedTo.senderType === "team" ? "Support" : "System";

  let summary: string;
  if (repliedTo.deletedAt) {
    summary = "Deleted message";
  } else if (repliedTo.type === "image") {
    summary = "[Photo]";
  } else if (repliedTo.type === "voice") {
    summary = "[Voice message]";
  } else if (repliedTo.type === "video") {
    summary = "[Video]";
  } else if (repliedTo.type === "call") {
    summary = "[Call]";
  } else {
    summary = repliedTo.body;
  }

  return (
    <div className="mb-1.5 overflow-hidden rounded-lg border-l-[3px] border-primary-400/70 bg-white/[0.06] px-2.5 py-1.5">
      <p className="text-xs font-semibold text-primary-300">{label}</p>
      <p className="truncate text-xs text-zinc-400">{summary}</p>
    </div>
  );
}

export default function MessageBubble({
  message,
  isOwn,
  onReply,
  onDelete,
  onEdit,
  onMediaClick,
  onRetrySend,
  onDeleteLocal,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const attachment = parseAttachment(message.attachmentJson);
  const mediaUrl = attachment?.url ?? "";
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMediaFailed(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mediaUrl]);

  if (message.type === "system") {
    return (
      <div className={`flex justify-center px-3 ${isFirstInGroup ? "mt-4" : ""} ${isLastInGroup ? "mb-4" : "my-1.5"}`}>
        <div className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-1.5 ring-1 ring-white/10">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-zinc-400"
          >
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          <p className="text-xs text-zinc-400">{message.body}</p>
        </div>
      </div>
    );
  }

  if (message.deletedAt) {
    return (
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} px-3 sm:px-5 ${
          isFirstInGroup ? "mt-2.5" : ""
        } ${isLastInGroup ? "mb-2.5" : "mb-1"}`}
      >
        <div className="max-w-[82%] sm:max-w-[72%]">
          {message.repliedTo && <ReplyPreview repliedTo={message.repliedTo} />}
          <p className="text-sm italic text-zinc-500">This message was deleted</p>
        </div>
      </div>
    );
  }

  const bubbleShape = `rounded-2xl ${
    isFirstInGroup ? (isOwn ? "rounded-br-lg" : "rounded-bl-lg") : ""
  }`;

  const bubbleColor = isOwn
    ? "bg-gradient-to-b from-primary-600 to-primary-600/90 text-white shadow-md shadow-primary-900/40"
    : "bg-white/[0.09] text-zinc-50 ring-1 ring-white/10";

  const bubbleContent = () => {
    switch (message.type) {
      case "image":
        if (!attachment?.url || mediaFailed) {
          return (
            <div className="grid h-44 w-44 place-items-center rounded-xl bg-white/5 p-2 text-center text-sm text-zinc-500">
              Photo unavailable
            </div>
          );
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-80 w-64 cursor-zoom-in rounded-xl object-cover sm:w-72"
            onClick={() => onMediaClick?.(attachment, message)}
            onError={() => setMediaFailed(true)}
          />
        );

      case "voice":
        return attachment?.url ? (
          <audio controls src={attachment.url} className="h-11 w-60 max-w-full sm:w-72" />
        ) : (
          <div className="grid h-11 w-60 max-w-full place-items-center rounded-xl bg-white/5 text-sm text-zinc-500">
            Voice note unavailable
          </div>
        );

      case "video":
        return attachment?.url ? (
          <video
            controls
            src={attachment.url}
            className="max-h-80 w-64 rounded-xl object-contain sm:w-72"
            onError={() => setMediaFailed(true)}
          />
        ) : (
          <div className="grid h-36 w-60 place-items-center rounded-xl bg-white/5 text-sm text-zinc-500">
            Video unavailable
          </div>
        );

      case "call":
        return (
          <div className="flex items-center gap-2.5 px-2 py-1">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-zinc-300"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
            <span className="text-[15px] font-medium text-zinc-100">Call ended</span>
          </div>
        );

      default:
        return (
          <p className="break-words whitespace-pre-wrap text-[15px] leading-6 sm:text-base sm:leading-7">
            {message.body}
            {message.editedAt && (
              <span className="ml-1 text-xs opacity-70">(edited)</span>
            )}
          </p>
        );
    }
  };

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} px-3 sm:px-5 ${
        isFirstInGroup ? "mt-2.5" : ""
      } ${isLastInGroup ? "mb-3" : "mb-1"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="group relative max-w-[85%] sm:max-w-[72%]">
        {message.repliedTo && <ReplyPreview repliedTo={message.repliedTo} />}

        <div className={`relative px-4 py-2.5 ${bubbleShape} ${bubbleColor}`}>
          {bubbleContent()}
        </div>

        <div
          className={`mt-1 flex select-none items-center gap-1.5 px-1 ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          <span className="text-xs text-zinc-500">{formatTime(message.createdAt)}</span>
          {isOwn && (
            <StatusTicks
              status={message.status}
              deliveredAt={message.deliveredAt}
              readAt={message.readAt}
            />
          )}
        </div>

        {isOwn && message.status === "FAILED" && (onRetrySend || onDeleteLocal) && (
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <span className="text-xs text-red-400/90">Couldn&apos;t send</span>
            {onRetrySend && (
              <button
                onClick={onRetrySend}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                Retry
              </button>
            )}
            {onDeleteLocal && (
              <button
                onClick={onDeleteLocal}
                className="rounded-full border border-red-400/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {hovered && (
          <div
            className={`absolute top-0 z-10 flex gap-1 ${
              isOwn ? "-left-20" : "-right-20"
            }`}
          >
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-sm text-zinc-300 shadow-xl ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                title="Reply"
              >
                ↩
              </button>
            )}
            {onEdit &&
              isOwn &&
              message.type === "text" &&
              !message.deletedAt && (
                <button
                  onClick={() => {
                    const newBody = prompt("Edit message:", message.body);
                    if (newBody !== null && newBody.trim() && newBody !== message.body) {
                      onEdit(message, newBody.trim());
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-sm text-zinc-300 shadow-xl ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                  title="Edit"
                >
                  ✎
                </button>
              )}
            {onDelete && !message.deletedAt && (
              <button
                onClick={() => onDelete(message)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-sm text-zinc-300 shadow-xl ring-1 ring-white/10 hover:bg-red-500/20 hover:text-red-400"
                title="Delete"
              >
                🗑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}