"use client";

import { useState } from "react";

export default function TicketQrDisplay({ ticketCode }: { ticketCode: string }) {
  const [downloading, setDownloading] = useState(false);

  const qrUrl = `/api/tickets/qr/${ticketCode}`;

  function handleDownload() {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `ticket-${ticketCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1000);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/10">
        <img
          src={qrUrl}
          alt={`QR ticket ${ticketCode}`}
          width={280}
          height={280}
          className="block"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <p className="font-mono text-sm text-zinc-300">{ticketCode}</p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-50"
      >
        {downloading ? "Saving…" : "Download QR Code"}
      </button>
    </div>
  );
}
