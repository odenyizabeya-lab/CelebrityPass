import { listAdminConversations } from "@/lib/chat/admin-list";
import AdminMessages from "@/components/chat/admin/AdminMessages";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const initial = await listAdminConversations();
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Fan conversations across every community. Reply as the celebrity&apos;s team.
      </p>
      <div className="mt-6">
        <AdminMessages initialConversations={initial} />
      </div>
    </div>
  );
}