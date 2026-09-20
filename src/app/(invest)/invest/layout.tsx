import { AppHeader } from "@/components/invest-app/AppHeader";
import { BottomNav } from "@/components/invest-app/BottomNav";

export const dynamic = "force-dynamic";

export default function InvestAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#05060a] pb-[calc(env(safe-area-inset-bottom)+5.75rem)]">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pb-10 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}