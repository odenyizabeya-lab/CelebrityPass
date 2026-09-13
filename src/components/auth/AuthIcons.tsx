import type { ReactNode } from "react";

const base = {
  className: "h-5 w-5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MailIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a8.25 8.25 0 0 1 15 0" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9ZM3.6 9h16.8M3.6 15h16.8" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M2.25 12s3.75-6.75 9.75-6.75c6 0 9.75 6.75 9.75 6.75S18 18.75 12 18.75C6 18.75 2.25 12 2.25 12Z" />
      <path d="M12 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M3.98 8.223A10.477 10.477 0 0 0 1.5 12s3.75 6.75 10.5 6.75c.75 0 1.44-.08 2.09-.24M6.32 6.03A10.58 10.58 0 0 1 12 5.25c6.75 0 10.5 6.75 10.5 6.75a10.48 10.48 0 0 1-3.24 3.786M9.75 9.75A2.25 2.25 0 0 0 14.25 14.25M12 5.25v4M9.75 9.75l-2.1-2.1m7.35 7.35-2.1-2.1" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg {...base} strokeWidth={2} aria-hidden>
      <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

export function renderAuthIcon(name: "mail" | "lock" | "user" | "globe"): ReactNode {
  switch (name) {
    case "mail":
      return <MailIcon />;
    case "lock":
      return <LockIcon />;
    case "user":
      return <UserIcon />;
    case "globe":
      return <GlobeIcon />;
    default:
      return null;
  }
}