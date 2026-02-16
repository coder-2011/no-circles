import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Serendipitous Encounters",
  description: "Personalized daily newsletter"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Link
          aria-label="Go to home"
          className="fixed left-4 top-4 z-50 inline-flex items-center rounded-full border border-white/30 bg-slate-950/70 p-2 backdrop-blur transition hover:bg-slate-900/90"
          href="/#top"
        >
          <Image alt="Serendipitous Encounters logo" height={32} src="/image.svg" width={32} />
        </Link>
        {children}
      </body>
    </html>
  );
}
