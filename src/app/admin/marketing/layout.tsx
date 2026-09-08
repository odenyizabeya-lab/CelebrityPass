import MarketingNav from "@/components/admin/marketing/MarketingNav";

export const dynamic = "force-dynamic";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <MarketingNav />
      <div>{children}</div>
    </div>
  );
}