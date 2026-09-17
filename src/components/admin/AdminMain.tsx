"use client";

import { usePathname } from "next/navigation";
import { isAdminChatRoomPath } from "@/lib/chat/admin-routes";

/** Content area. Chat rooms are edge-to-edge full height; the rest of the
 *  admin keeps breathing room + padding for the mobile bottom app bar. */
export default function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatRoom = isAdminChatRoomPath(pathname);
  if (chatRoom) {
    return <main className="h-full min-h-0">{children}</main>;
  }
  return <main className="p-4 pb-24 sm:p-8 sm:pb-28 lg:pb-8">{children}</main>;
}