import NotificationSettings from "@/components/admin/notifications/NotificationSettings";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-white">Email Notifications</h1>
        <p className="mt-1 text-sm text-zinc-400">Configure transactional email for your platform.</p>
      </div>
      <NotificationSettings />
    </div>
  );
}
