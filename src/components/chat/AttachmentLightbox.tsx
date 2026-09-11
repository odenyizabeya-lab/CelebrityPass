"use client";

import { useEffect } from "react";

export interface LightboxAttachment {
  url: string;
  mime?: string;
  name?: string;
}

export default function AttachmentLightbox({
  attachment,
  onClose,
}: {
  attachment: LightboxAttachment | null;
  onClose: () => void;
}) {
  const lastAttachment = attachment ?? null;

  useEffect(() => {
    if (!lastAttachment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastAttachment, onClose]);

  if (!lastAttachment) return null;
  const isImage = (lastAttachment.mime ?? "").startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
        aria-label="Close preview"
      >
        ×
      </button>
      <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lastAttachment.url}
            alt={lastAttachment.name ?? "Attachment"}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
          />
        ) : (
          <video
            src={lastAttachment.url}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-xl"
          />
        )}
        {lastAttachment.name && (
          <p className="mt-2 text-center text-xs text-zinc-400">
            {lastAttachment.name}
          </p>
        )}
      </div>
    </div>
  );
}