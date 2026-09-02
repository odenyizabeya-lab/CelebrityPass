/**
 * Verified checkmark in the style used by Instagram, Facebook and TikTok —
 * a solid blue badge with a white check. Rendered for every celebrity
 * automatically, so nothing extra needs to be configured when adding one.
 */
export default function VerifiedBadge({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Verified celebrity"
    >
      <title>Verified</title>
      <circle cx="12" cy="12" r="10.5" fill="#1D9BF0" />
      <path
        d="M7.5 12.4l3 3 6-6.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}