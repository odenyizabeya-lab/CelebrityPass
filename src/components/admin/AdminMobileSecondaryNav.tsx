"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminChatRoomPath } from "@/lib/chat/admin-routes";

const TABS = [
  { href: "/admin/fans", label: "Fans" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/cards", label: "Cards" },
  { href: "/admin/marketing/overview", label: "Marketing" },
  { href: "/admin/payments/bank", label: "Bank Accounts" },
  { href: "/admin/payments/verify", label: "Verify Transfers" },
  { href: "/admin/ai-settings", label: "AI Settings" },
  { href: "/admin/payment-settings", label: "Payment Settings" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/emails", label: "Email Center" },
  { href: "/admin/security", label: "Account & Security" },
  { href: "/admin/events/sources", label: "Event Sources" },
];

/** Mobile secondary nav. Hidden on the open chat room so the room is a true
 *  full-screen app screen (back arrow in the header handles navigation). */
export default function AdminMobileSecondaryNav() {
  const pathname = usePathname();
  if (isAdminChatRoomPath(pathname)) return null;

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-3 lg:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}