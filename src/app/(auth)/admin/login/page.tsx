import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { isAdminAuthedSupabase } from "@/lib/supabase/server";
import { getAdminEmail, getAdminEmails } from "@/lib/admin/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const allowedEmails = await getAdminEmails();
  const initialEmail = (await getAdminEmail()).trim().toLowerCase();
  if (await isAdminAuthedSupabase()) redirect("/admin/overview");
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-16">
      <AdminLoginForm initialEmail={initialEmail} allowedEmails={allowedEmails} />
    </div>
  );
}
