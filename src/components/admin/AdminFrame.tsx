"use client";

import { usePathname } from "next/navigation";
import { isAdminChatRoomPath } from "@/lib/chat/admin-routes";

/** Full-height frame. An open chat room uses the whole viewport (native-app
 *  feel); every other admin page keeps its scrollable padded layout. */
export default function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatRoom = isAdminChatRoomPath(pathname);
  return (
    <div
      className={
        chatRoom
          ? "flex h-dvh min-h-0 overflow-hidden"
          : "flex min-h-[calc(100vh-4rem)]"
      }
    >
      {children}
    </div>
  );
}