"use client";

import { useState } from "react";

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
  if (status === "PENDING" || status === "FAILED") {
    // Accepted and saved locally, still waiting for the server — ONE check.
    // FAILED is never surfaced as a hard error: the outbox keeps retrying and
    // the message stays in the local queue until the server acknowledges it.
    return (
      <span
        className="text-[10px] text-zinc-400"
        title={status === "PENDING" ? "Queued — waiting to sync" : "Queued — will retry automatically"}
      >
        ✓
      </span>
    );
  }
  if (readAt) {
    return (
      <span className="text-[10px] text-sky-300" title="Read">
        ✓✓
      </span>
    );
  }
  if (deliveredAt) {
    return (
      <span className="text-[10px] text-zinc-400" title="Delivered">
        ✓✓
      </span>
    );
  }
  return (
    <span className="text-[10px] text-zinc-400" title="Sent">
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
    <div className="mb-1 rounded-md border-l-2 border-primary-500/50 bg-white/5 px-2 py-1 text-xs opacity-80">
      <p className="font-medium text-primary-400">{label}</p>
      <p className="truncate text-zinc-400">{summary}</p>
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
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);

  if (message.type === "system") {
    return (
      <div className="my-2 flex justify-center">
        <p className="text-xs text-zinc-500">{message.body}</p>
      </div>
    );
  }

  if (message.deletedAt) {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1 px-1`}>
        <div className={`max-w-[75%] ${isFirstInGroup && !isOwn ? "mt-2" : ""} ${isLastInGroup && !isOwn ? "mb-2" : ""}`}>
          {message.repliedTo && <ReplyPreview repliedTo={message.repliedTo} />}
          <p className="text-xs italic text-zinc-500">This message was deleted</p>
        </div>
      </div>
    );
  }

  const attachment = parseAttachment(message.attachmentJson);

  const bubbleContent = () => {
    switch (message.type) {
      case "image":
        return attachment ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-64 max-w-64 cursor-zoom-in rounded-lg object-cover"
            onClick={() => onMediaClick?.(attachment, message)}
          />
        ) : null;

      case "voice":
        return (
          <audio
            controls
            src={attachment?.url}
            className="h-9 w-52 max-w-full"
          />
        );

      case "video":
        return (
          <video
            controls
            src={attachment?.url}
            className="max-h-64 max-w-64 rounded-lg"
          />
        );

      case "call":
        return (
          <div className="flex items-center gap-2">
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
            <span className="text-sm">Call ended</span>
          </div>
        );

      default:
        return (
          <p className="break-words whitespace-pre-wrap text-sm">
            {message.body}
            {message.editedAt && (
              <span className="ml-1 text-[10px] opacity-70">(edited)</span>
            )}
          </p>
        );
    }
  };

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1 px-1`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`group relative max-w-[75%] ${
          isFirstInGroup && !isOwn ? "mt-2" : ""
        } ${isLastInGroup && !isOwn ? "mb-2" : ""} ${
          isFirstInGroup && isOwn ? "mt-2" : ""
        } ${isLastInGroup && isOwn ? "mb-2" : ""}`}
      >
        {message.repliedTo && <ReplyPreview repliedTo={message.repliedTo} />}

        <div
          className={`relative rounded-2xl px-3 py-2 ${
            isOwn
              ? `bg-primary-600 text-white ${
                  isFirstInGroup ? "rounded-br-md" : ""
                }`
              : `bg-white/10 text-zinc-100 ${
                  isFirstInGroup ? "rounded-bl-md" : ""
                }`
          }`}
        >
          {bubbleContent()}
        </div>

        <div
          className={`mt-0.5 flex select-none items-center gap-1.5 ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          <span className="text-[10px] text-zinc-500">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && (
            <StatusTicks
              status={message.status}
              deliveredAt={message.deliveredAt}
              readAt={message.readAt}
            />
          )}
        </div>

        {hovered && (
          <div
            className={`absolute top-0 z-10 flex gap-0.5 ${
              isOwn ? "-left-16" : "-right-16"
            }`}
          >
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-xs text-zinc-400 shadow-lg hover:bg-white/10 hover:text-zinc-200"
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
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-xs text-zinc-400 shadow-lg hover:bg-white/10 hover:text-zinc-200"
                  title="Edit"
                >
                  ✎
                </button>
              )}
            {onDelete && !message.deletedAt && (
              <button
                onClick={() => onDelete(message)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-xs text-zinc-400 shadow-lg hover:bg-red-500/20 hover:text-red-400"
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
