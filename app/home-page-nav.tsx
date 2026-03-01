import Link from "next/link";

type HomePageNavProps = {
  activeTab: "home" | "how-it-works";
  className?: string;
};

export function HomePageNav({ activeTab, className }: HomePageNavProps) {
  return (
    <nav aria-label="Primary" className={["home-page__top-nav", className].filter(Boolean).join(" ")}>
      <Link
        aria-current={activeTab === "home" ? "page" : undefined}
        className={["home-page__top-nav-link", activeTab === "home" ? "is-active" : ""].join(" ")}
        href="/"
      >
        Home
      </Link>
      <Link
        aria-current={activeTab === "how-it-works" ? "page" : undefined}
        className={["home-page__top-nav-link", activeTab === "how-it-works" ? "is-active" : ""].join(" ")}
        href="/how-it-works"
      >
        How It Works
      </Link>
    </nav>
  );
}
