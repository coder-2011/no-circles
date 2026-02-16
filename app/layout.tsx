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
          className="fixed left-3 top-3 z-50 inline-block leading-none"
          href="/#top"
        >
          <Image
            alt="Serendipitous Encounters logo"
            className="block h-16 w-16 rounded-lg object-contain scale-125"
            height={64}
            src="/logo-green.svg"
            width={64}
          />
        </Link>
        {children}
      </body>
    </html>
  );
}
