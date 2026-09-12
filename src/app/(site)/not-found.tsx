import Link from "next/link";

export default function SiteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary-400">404</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
        This page doesn&apos;t exist or may have moved. Head home to keep exploring CelebrityPass.
      </p>
      <Link
        href="/"
        className="btn-grad mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
      >
        Go to Home
      </Link>
    </div>
  );
}