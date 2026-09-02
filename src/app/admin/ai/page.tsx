import Link from "next/link";
import AiSettings from "@/components/admin/ai/AiSettings";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">AI Scanner</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Set your Gemini API key here. Then upload a celebrity photo in Add Celebrity and press Scan — it fills the
            whole form for you.
          </p>
        </div>
        <Link href="/admin/celebrities" className="text-sm font-semibold text-zinc-400 transition hover:text-white">
          ← Celebrities
        </Link>
      </div>

      <div className="mt-6">
        <AiSettings />
      </div>

      <div className="mt-8 max-w-2xl">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">How to get a free Gemini key</h3>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-zinc-400">
          <li>Go to <code className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-200">aistudio.google.com/apikey</code></li>
          <li>Sign in with any Google account and click <strong>Create API key</strong>.</li>
          <li>Copy the key and paste it above, then <strong>Save key</strong>.</li>
          <li>Back in <strong>Add Celebrity</strong>, upload the photo and press <strong>Scan</strong> — the form auto-fills.</li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          A free tier is included with Gemini. If scanning fails on a free key, the error message will tell you what to adjust.
        </p>
      </div>
    </div>
  );
}