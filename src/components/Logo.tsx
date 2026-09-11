type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const TILE_STYLES: Record<LogoSize, string> = {
  xs: "h-5 w-5 rounded-md",
  sm: "h-6 w-6 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-20 w-20 rounded-[1.5rem]",
};

const STAR =
  "M256 86 L294.21 203.41 L417.68 203.47 L317.82 276.09 L355.92 393.53 L256 321 L156.08 393.53 L194.18 276.09 L94.32 203.47 L217.79 203.41 Z";
const STRIPE = "M110 297 L128 337 L402 215 L384 175 Z";

export function StarGlyph({
  className = "h-[68%] w-[68%]",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <path fill="#ffffff" d={STAR} />
      <path fill="#fbbf24" d={STRIPE} />
    </svg>
  );
}

interface LogoProps {
  variant?: "mark" | "full";
  size?: LogoSize;
  className?: string;
}

export default function Logo({ variant = "mark", size = "md", className = "" }: LogoProps) {
  if (variant === "full") {
    return (
      <span className="inline-flex items-center gap-2.5">
        <Logo size={size} className={className} />
        <span className="whitespace-nowrap text-lg font-bold tracking-tight">
          Celebrity<span className="gradient-text">Pass</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-grid shrink-0 place-items-center bg-gradient-to-br from-primary-600 to-accent-500 ${TILE_STYLES[size]} ${className}`}
    >
      <StarGlyph />
    </span>
  );
}