import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";

const editorialFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["500", "600", "700"]
});

const uiFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Serendipitous Encounters",
  description: "Personalized daily newsletter"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${editorialFont.variable} ${uiFont.variable}`} suppressHydrationWarning>
        <Link
          aria-label="Go to home"
          className="fixed left-4 top-4 z-50 inline-block rounded-xl border border-[#C5B993] bg-[#F3ECD8] p-1 leading-none shadow-sm"
          href="/#top"
        >
          <Image
            alt="Serendipitous Encounters logo"
            className="block h-8 w-8 rounded-lg"
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
