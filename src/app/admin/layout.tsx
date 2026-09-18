import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthedSupabase } from "@/lib/supabase/server";
import AdminFrame from "@/components/admin/AdminFrame";
import AdminMain from "@/components/admin/AdminMain";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminMobileSecondaryNav from "@/components/admin/AdminMobileSecondaryNav";
import AdminMessagesBadge from "@/components/admin/AdminMessagesBadge";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthedSupabase();
  if (!authed) redirect("/admin/login");

  return (
    <AdminFrame>
      <aside className="hidden w-60 shrink-0 border-r border-white/[0.06] bg-ink-950/40 p-5 lg:block">
        <p className="px-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Admin</p>
        <nav className="mt-4 space-y-1">
          <AdminLink href="/admin/overview" label="Overview" />
          <AdminLink href="/admin/celebrities" label="Celebrities" />
          <AdminLink href="/admin/events" label="Events" />
          <AdminLink href="/admin/tickets" label="Tickets" />
          <AdminLink href="/admin/fans" label="Fans" />
          <AdminLink href="/admin/messages" label="Messages" badge={<AdminMessagesBadge />} />
          <AdminLink href="/admin/cards" label="Cards" />
          <AdminLink href="/admin/payments" label="Payments" />
          <AdminLink href="/admin/marketing/overview" label="Marketing" />
        </nav>
        <div className="mt-8 border-t border-white/[0.06] pt-5">
          <p className="px-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Platform</p>
          <nav className="mt-4 space-y-1">
            <AdminLink href="/admin/events/sources" label="Event Sources" />
            <AdminLink href="/admin/notifications" label="Notifications" />
            <AdminLink href="/admin/emails" label="Email Center" />
            <AdminLink href="/admin/payments/bank" label="Bank Accounts" />
            <AdminLink href="/admin/payments/verify" label="Verify Transfers" />
            <AdminLink href="/admin/ai-settings" label="AI Settings" />
            <AdminLink href="/admin/payment-settings" label="Payment Settings" />
            <AdminLink href="/admin/invest/deposits" label="Investor Deposits" />
            <AdminLink href="/admin/invest/opportunities" label="Investments" />
            <AdminLink href="/admin/security" label="Account & Security" />
            <Link
              href="/"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              View public site →
            </Link>
            <SignOutForm />
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileSecondaryNav />
        <AdminMain>{children}</AdminMain>
      </div>
      <AdminBottomNav />
    </AdminFrame>
  );
}

function AdminLink({
  href,
  label,
  compact,
  badge,
}: {
  href: string;
  label: string;
  compact?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex items-center gap-2 truncate text-sm font-medium transition ${
        compact
          ? "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-zinc-300 ring-1 ring-white/10"
          : "rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="truncate">{label}</span>
      {badge}
    </Link>
  );
}

function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        try {
          const { createServerSupabase } = await import("@/lib/supabase/server");
          const supabase = await createServerSupabase();
          await supabase.auth.signOut();
        } catch {
          // Sign out locally regardless of upstream errors.
        }
        redirect("/admin/login");
      }}
    >
      <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
        Sign out
      </button>
    </form>
  );
}