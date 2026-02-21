import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
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
  title: "The No-Circles Project",
  description: "Personalized daily newsletter",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png"
  }
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
          <img
            alt="No Circles logo"
            className="block h-16 w-16 rounded-full object-contain"
            height={64}
            src="/logo-no-circles.svg"
            width={64}
          />
        </Link>
        {children}
      </body>
    </html>
  );
}
