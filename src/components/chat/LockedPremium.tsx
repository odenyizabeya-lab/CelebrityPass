"use client";

export default function LockedPremium({
  feature,
  onGetCard,
  name,
  price = "$1,000",
}: {
  feature: "voice" | "video";
  onGetCard: () => void;
  name?: string;
  price?: string;
}) {
  const title =
    feature === "voice" ? "Voice calls are a premium perk" : "Video calls are a premium perk";

  return (
    <div className="glass rounded-2xl border border-gold-500/30 px-6 py-8 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-gold-500/15 ring-1 ring-gold-400/30">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gold-400"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <p className="text-lg font-bold text-gold-400">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
        Get your Fan Card{typeof name === "string" && name ? ` for ${name}` : ""} to unlock voice
        &amp; video calls{" "}
        {price ? `starting at ${price}` : ""}.
      </p>
      <button
        onClick={onGetCard}
        className="btn-grad mt-6 rounded-full px-6 py-2.5 text-sm font-bold text-white"
      >
        Get Fan Card
      </button>
    </div>
  );
}