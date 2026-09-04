import AdminSecuritySettings from "@/components/admin/security/AdminSecuritySettings";
import { getAdminEmail } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const email = await getAdminEmail();
  return (
    <div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">Account &amp; Security</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage the admin sign-in: change your password, update the primary email, and turn on two-step verification.
        </p>
      </div>
      <div className="mt-6">
        <AdminSecuritySettings initialEmail={email} />
      </div>
    </div>
  );
}