import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MarketingIndexPage() {
  redirect("/admin/marketing/overview");
}
