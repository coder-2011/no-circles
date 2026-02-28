export type SampleBriefItem = {
  title: string;
  url: string;
  summary: string;
};

export const SAMPLE_DAILY_BRIEF: SampleBriefItem[] = [
  {
    title: "AI Update, February 20, 2026: AI News and Views From the Past Week",
    url: "https://www.marketingprofs.com/opinions/2026/54328/ai-update-february-20-2026-ai-news-and-views-from-the-past-week",
    summary:
      "LinkedIn overhauled its SEO strategy following a significant decline in B2B traffic. The platform reported that non-brand, awareness-driven B2B traffic dropped by up to 60% as AI-powered search experiences reduced clickthrough behavior, even though search rankings remained stable. This traffic decline prompted LinkedIn to reassess its approach to search engine optimization."
  },
  {
    title: "Global Summits to Watch in 2026: Bracing for a New Global (Dis)order",
    url: "https://www.cfr.org/articles/global-summits-watch-2026-bracing-new-global-disorder",
    summary:
      "Major global forums are scheduled in 2026 covering climate change, trade, and security. The Donald Trump administration's ongoing overhaul of U.S. foreign policy could disrupt how these gatherings are conducted. The World Economic Forum in Davos, Switzerland represents one such venue where these dynamics may unfold."
  },
  {
    title: "26 Trends Affecting Capital Markets in 2026",
    url: "https://corpgov.law.harvard.edu/2026/01/25/26-trends-affecting-capital-markets-in-2026/",
    summary:
      "Capital markets have experienced significant structural shifts, particularly the rise of private markets relative to public markets. Private assets grew from $9.7 trillion in 2012 to $22 trillion in 2024, more than doubling over 12 years. Companies are staying private longer, with an average wait of 16 years before going public, representing a 33 percent increase compared to a decade earlier. These trends have become more pronounced since the Sarbanes-Oxley Act adoption. Enhanced retail access to private markets has emerged as a focus of policymaker attention following recent administrative changes."
  },
  {
    title: "Economic Trends for 2026 and Beyond | Vistage",
    url: "https://www.vistage.com/research-center/business-financials/economic-trends/20251027-economic-trends-for-2026-and-beyond/",
    summary:
      "Small and midsize businesses face sustained stagflationary conditions in 2026 and beyond, with inflation remaining above the Federal Reserve's target despite cooling from 40-year highs. Tariffs and rising input costs are compressing margins, while labor scarcity drives wage and benefit increases. The cost of capital remains elevated, constraining growth plans. The analysis recommends that SMBs prioritize margin protection over revenue growth. Opportunities exist in productivity gains through AI and expansion in tech, healthcare, and clean energy sectors. Through Q3 2025, the S&P 500 gained 9.8% and the Nasdaq showed resilience despite these economic headwinds."
  }
];

export const HOME_PAGE_SUBSYSTEMS = [
  {
    number: "01",
    title: "Memory",
    description:
      "Onboarding and replies maintain one canonical profile with personality, active interests, and recent feedback."
  },
  {
    number: "02",
    title: "Discovery",
    description:
      "The system builds queries, searches current sources, and reserves part of each issue for adjacent serendipity."
  },
  {
    number: "03",
    title: "Grounding",
    description:
      "Winning links get real extracted highlights before summaries are written, so the brief stays source-tethered."
  },
  {
    number: "04",
    title: "Anti-repeat",
    description:
      "A per-user Bloom filter suppresses likely repeats without needing a huge row-per-link history table."
  },
  {
    number: "05",
    title: "Delivery",
    description:
      "Postgres claims due users by local send time, the app runs bounded batch sends, and Resend handles delivery."
  },
  {
    number: "06",
    title: "Feedback loop",
    description:
      "Replies, one-click feedback, and a bi-daily reflection pass all help tomorrow's issue adjust without overreacting."
  }
] as const;
