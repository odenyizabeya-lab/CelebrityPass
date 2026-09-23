import Link from "next/link";
import Logo from "@/components/Logo";
import LanguageSelector from "@/components/LanguageSelector";
import { HomeBottomNav } from "@/components/home-app/HomeBottomNav";

/**
 * The CelebrityPass HOME is a native-style app shell (like the invest app),
 * NOT the website: phone-column content, sticky app top bar, floating bottom
 * navigation. It intentionally has no site header/footer — this is the app
 * home screen users sign in to, not the marketing site.
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#05060a] pb-[calc(env(safe-area-inset-bottom)+5.75rem)]">
      {/* App top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05060a]/92 px-3 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="CelebrityPass home">
            <Logo size="md" />
            <span className="min-w-0 truncate text-[18px] font-black tracking-tight">
              Celebrity<span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Pass</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageSelector />
            <Link
              href="/account"
              aria-label="Your profile"
              className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.05] text-zinc-200 ring-1 ring-white/[0.07] transition active:scale-95 active:bg-white/[0.1]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0 17.9 17.9 0 01-7.5 1.65 17.9 17.9 0 01-7.5-1.65z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-10 pt-4">{children}</main>

      <HomeBottomNav />
    </div>
  );
}