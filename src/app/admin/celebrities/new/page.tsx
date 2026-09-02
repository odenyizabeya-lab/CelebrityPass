import CelebrityForm from "@/components/admin/CelebrityForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NewCelebrityPage() {
  return (
    <div>
      <Link href="/admin/celebrities" className="text-sm font-semibold text-zinc-400 transition hover:text-white">
        ← Back to celebrities
      </Link>
      <div className="mt-4">
        <CelebrityForm mode="create" />
      </div>
    </div>
  );
}