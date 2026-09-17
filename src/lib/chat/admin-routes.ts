/** True when the current route is an open chat room (full-screen app mode). */
export function isAdminChatRoomPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin/messages/") &&
    pathname.length > "/admin/messages/".length
  );
}