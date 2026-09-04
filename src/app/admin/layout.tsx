import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();
  if (!authed) redirect("/admin/login");

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden w-60 shrink-0 border-r border-white/[0.06] bg-ink-950/40 p-5 lg:block">
        <p className="px-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Admin</p>
        <nav className="mt-4 space-y-1">
          <AdminLink href="/admin/overview" label="Overview" />
          <AdminLink href="/admin/celebrities" label="Celebrities" />
          <AdminLink href="/admin/events" label="Events" />
          <AdminLink href="/admin/tickets" label="Tickets" />
          <AdminLink href="/admin/fans" label="Fans" />
          <AdminLink href="/admin/cards" label="Cards" />
          <AdminLink href="/admin/payments" label="Payments" />
        </nav>
        <div className="mt-8 border-t border-white/[0.06] pt-5">
          <p className="px-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Platform</p>
          <nav className="mt-4 space-y-1">
            <AdminLink href="/admin/events/sources" label="Event Sources" />
            <AdminLink href="/admin/ai" label="AI Scanner" />
            <AdminLink href="/admin/notifications" label="Notifications" />
            <AdminLink href="/admin/payments/bank" label="Bank Accounts" />
            <AdminLink href="/admin/payments/verify" label="Verify Transfers" />
            <AdminLink href="/admin/security" label="Account & Security" />
            <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
              View public site →
            </Link>
            <SignOutForm />
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile nav */}
        <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-3 lg:hidden">
          <AdminLink href="/admin/overview" label="Overview" compact />
          <AdminLink href="/admin/celebrities" label="Celebrities" compact />
          <AdminLink href="/admin/events" label="Events" compact />
          <AdminLink href="/admin/tickets" label="Tickets" compact />
          <AdminLink href="/admin/fans" label="Fans" compact />
          <AdminLink href="/admin/cards" label="Cards" compact />
          <AdminLink href="/admin/payments" label="Payments" compact />
          <AdminLink href="/admin/payments/bank" label="Bank Accounts" compact />
          <AdminLink href="/admin/payments/verify" label="Verify Transfers" compact />
          <AdminLink href="/admin/ai" label="AI Scanner" compact />
          <AdminLink href="/admin/notifications" label="Notifications" compact />
          <AdminLink href="/admin/security" label="Account & Security" compact />
        </div>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

function AdminLink({ href, label, compact }: { href: string; label: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className={`block truncate text-sm font-medium transition ${
        compact
          ? "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-zinc-300 ring-1 ring-white/10"
          : "rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        const { clearAdminSession } = await import("@/lib/auth");
        await clearAdminSession();
        redirect("/admin/login");
      }}
    >
      <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
        Sign out
      </button>
    </form>
  );
}