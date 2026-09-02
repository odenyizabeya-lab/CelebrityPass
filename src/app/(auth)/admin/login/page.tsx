import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { isAdminAuthed } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect("/admin/overview");
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-16">
      <AdminLoginForm />
    </div>
  );
}