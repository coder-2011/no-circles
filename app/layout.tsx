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
          className="fixed left-4 top-4 z-50 inline-block leading-none"
          href="/#top"
        >
          <Image
            alt="Serendipitous Encounters logo"
            className="block h-8 w-8 rounded-none"
            height={32}
            src="/image.svg"
            width={32}
          />
        </Link>
        {children}
      </body>
    </html>
  );
}
