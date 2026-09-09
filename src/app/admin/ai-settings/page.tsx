import AiSettingsPane from "@/components/admin/ai/AiSettingsPane";

export const dynamic = "force-dynamic";

export default function AiSettingsPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">AI Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configure the AI used by the Automatic Celebrity Scanner. Gemini is the scanner&apos;s only provider — keys live
          server-side and are never exposed to the browser.
        </p>
      </div>
      <div className="mt-6 max-w-3xl">
        <AiSettingsPane />
      </div>
    </div>
  );
}