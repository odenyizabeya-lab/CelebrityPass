import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "FanVerse — Multi-Celebrity Fan Card Community",
    template: "%s | FanVerse",
  },
  description:
    "The multi-celebrity fan membership platform. Get an official verified fan card for your favorite artists, athletes, actors, and creators.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-aurora">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}