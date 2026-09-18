import { AppHeader } from "@/components/invest-app/AppHeader";
import { BottomNav } from "@/components/invest-app/BottomNav";

export const dynamic = "force-dynamic";

export default function InvestAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05060a] pb-24">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}