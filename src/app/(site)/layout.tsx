import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * The main website shell. Only the standard marketing/app pages live under
 * this route group — they get the CelebrityPass header and footer. Chat
 * lives outside the group with its own full-viewport layout.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}