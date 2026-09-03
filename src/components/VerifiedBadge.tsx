/**
 * Verified checkmark in the style used by Facebook, Instagram and TikTok —
 * a solid blue badge with a white check.
 *
 * Every celebrity published through the CelebrityPass admin is automatically
 * verified on creation and shows this badge (displayed on the same line as
 * the name, social-platform style).
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