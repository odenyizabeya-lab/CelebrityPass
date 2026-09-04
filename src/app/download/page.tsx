import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download the App",
  description: "Get the CelebrityPass app for Android and take your fan cards with you.",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Download</span>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Get the app</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">CelebrityPass for Android</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">
          Take your fan cards and communities with you. The CelebrityPass Android app uses the same account as the
          website, so your cards, membership levels, and communities stay consistent on any device.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass card-hover rounded-2xl p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-600/30 to-accent-500/30 text-xl ring-1 ring-white/10">🤖</div>
          <h2 className="mt-3 font-bold text-white">Android (Play Store)</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            The CelebrityPass app is distributed through the Google Play Store. Open the Play Store on your Android
            device, search for <strong>CelebrityPass</strong>, and tap Install.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            The app is built as package <code className="text-zinc-400">com.kcoai.app</code> and loads the live
            CelebrityPass platform over HTTPS.
          </p>
        </div>

        <div className="glass card-hover rounded-2xl p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-600/30 to-accent-500/30 text-xl ring-1 ring-white/10">🌐</div>
          <h2 className="mt-3 font-bold text-white">Any device (web)</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            CelebrityPass is fully responsive and works on phones, tablets, and desktop browsers — no install required.
            Just visit{" "}
            <a href="https://celebritypass.app" className="text-primary-400 underline">celebritypass.app</a>.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Before you install</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 leading-relaxed text-zinc-300">
          <li>The app and website share one account. Sign in with the same email and password.</li>
          <li>Your fan cards and communities appear the same on every device.</li>
          <li>
            For questions about the app or your account, visit our{" "}
            <Link href="/help" className="text-primary-400 underline">Help Center</Link> or{" "}
            <Link href="/legal/contact" className="text-primary-400 underline">Contact &amp; Support</Link>.
          </li>
        </ul>
      </section>
    </div>
  );
}
