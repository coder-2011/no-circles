import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const variants = [
  { slug: "01-riviera-sun", label: "Riviera Sun", bg: "#FBF7F2", panel: "#FEFCF9", border: "#E8DCCD", card: "#F1F7F8", cardBorder: "#D5E3E5", head: "#2A2622", body: "#47423D", link: "#2B6E77", deco: "#C79063", url: "#456B70", ser: "#836347", quoteT: "#2E666F", quoteB: "#3A3732", quoteA: "#785C43", foot: "#57504A", reply: "#2D636A" },
  { slug: "02-orchid-meadow", label: "Orchid Meadow", bg: "#F8F4FF", panel: "#FCFAFF", border: "#DDD3EF", card: "#F0F8F1", cardBorder: "#CEE2D1", head: "#28222F", body: "#443E4D", link: "#2F7A53", deco: "#8660BC", url: "#6D4D97", ser: "#5E6A9A", quoteT: "#2C714D", quoteB: "#373240", quoteA: "#62478C", foot: "#524C5D", reply: "#2C6C49" },
  { slug: "03-aurora-slate", label: "Aurora Slate", bg: "#EFF8FF", panel: "#F8FCFF", border: "#C9DFF0", card: "#F3F4FF", cardBorder: "#D7DAF5", head: "#1F2B38", body: "#344555", link: "#4A57B8", deco: "#2AA6A1", url: "#2F7484", ser: "#43618B", quoteT: "#2C6E9A", quoteB: "#2A3440", quoteA: "#3B5D92", foot: "#445667", reply: "#2E6690" },
  { slug: "04-terracotta-sea", label: "Terracotta Sea", bg: "#FFF4EE", panel: "#FFF9F5", border: "#F0D2C4", card: "#EEF9F8", cardBorder: "#CFE7E4", head: "#32261F", body: "#504037", link: "#247A88", deco: "#C66A4C", url: "#9A5238", ser: "#3A7380", quoteT: "#2E6E78", quoteB: "#40322C", quoteA: "#8A4C34", foot: "#5F4A40", reply: "#2F6C76" },
  { slug: "05-violet-sunlit", label: "Violet Sunlit", bg: "#F7F2FF", panel: "#FCFAFF", border: "#DDD0F0", card: "#FFF7EE", cardBorder: "#F1DEC6", head: "#2C2536", body: "#463E53", link: "#B2702C", deco: "#6C5AC4", url: "#8751A2", ser: "#A46D2F", quoteT: "#6A59B6", quoteB: "#393243", quoteA: "#7D4896", foot: "#554C61", reply: "#674FB0" },
  { slug: "06-coastal-brass", label: "Coastal Brass", bg: "#F3F6FB", panel: "#FAFCFE", border: "#D7DFEA", card: "#FBF6EE", cardBorder: "#E9DDCD", head: "#202B37", body: "#3B4958", link: "#3A6294", deco: "#B99061", url: "#3A6B7E", ser: "#7E6543", quoteT: "#385C8C", quoteB: "#313C48", quoteA: "#735A3E", foot: "#4C5968", reply: "#3B5A85" },
  { slug: "07-merlot-ink", label: "Merlot Ink", bg: "#FCF1F5", panel: "#FFF8FB", border: "#E8CED8", card: "#F1F2FF", cardBorder: "#D8DAF2", head: "#2E2328", body: "#4D3D45", link: "#4B56A5", deco: "#B45572", url: "#7F3F5A", ser: "#655393", quoteT: "#A64A67", quoteB: "#3C3037", quoteA: "#644885", foot: "#5B4A53", reply: "#903E58" },
  { slug: "08-forest-cream", label: "Forest Cream", bg: "#F2F8F0", panel: "#FAFDF8", border: "#D7E5D3", card: "#FFF6EC", cardBorder: "#F1E0C9", head: "#212C20", body: "#3C4B39", link: "#B7762E", deco: "#3E8A4A", url: "#2D6C37", ser: "#8B612F", quoteT: "#367A43", quoteB: "#2D392A", quoteA: "#7A5429", foot: "#4A5846", reply: "#336F3E" },
  { slug: "09-midnight-coral", label: "Midnight Coral", bg: "#EEF1FA", panel: "#F7F9FF", border: "#D2D9ED", card: "#FFF1EE", cardBorder: "#F1D2CA", head: "#23273A", body: "#3F455D", link: "#C45B4A", deco: "#4C63C7", url: "#7D4EA2", ser: "#A14F43", quoteT: "#465BB8", quoteB: "#30354A", quoteA: "#8A4565", foot: "#4C526A", reply: "#4458B0" },
  { slug: "10-mint-fig", label: "Mint Fig", bg: "#EEF8F3", panel: "#F8FFFB", border: "#CCE4D9", card: "#F6F2FF", cardBorder: "#DFD6F0", head: "#202D29", body: "#3A4A45", link: "#6D4F9E", deco: "#2F8F75", url: "#2F755F", ser: "#5E4A84", quoteT: "#2E836A", quoteB: "#2F3A37", quoteA: "#594278", foot: "#4A5A55", reply: "#2D7D65" }
];

const items = [
  { title: "Anthropic ships compact model upgrades for lower-latency reasoning", summary: "Anthropic announced updates focused on faster response times and improved instruction-following in lightweight deployments, with clearer guidance on model tiering.", url: "https://example.com/ai-model-upgrades", serendipity: false },
  { title: "SQLite team outlines practical patterns for durable edge sync", summary: "The post compares replication topologies and shows concrete conflict-resolution tradeoffs for partially connected clients.", url: "https://example.com/sqlite-edge-sync", serendipity: false },
  { title: "A long-read on Renaissance workshop systems and idea transfer", summary: "Historians trace how apprenticeships and material constraints shaped innovation cycles, with parallels to modern maker ecosystems.", url: "https://example.com/renaissance-workshops", serendipity: true },
  { title: "How one bio lab cut experiment cycle time by redesigning note flow", summary: "The team reduced repeat setup mistakes by moving from ad hoc docs to structured templates tied to instrument checkpoints.", url: "https://example.com/lab-note-flow", serendipity: false },
  { title: "A field report on AI-assisted code review quality at scale", summary: "Engineers measured where assistant comments improved merge confidence and where human review remained essential for system-level correctness.", url: "https://example.com/ai-code-review", serendipity: false },
  { title: "Urban history map reveals hidden trade routes behind modern tech hubs", summary: "Researchers connect legacy rail and port infrastructure to startup geography, arguing historical logistics still shape talent density.", url: "https://example.com/urban-history-tech-hubs", serendipity: true },
  { title: "Pragmatic guide: keeping retrieval pipelines grounded under pressure", summary: "The guide focuses on confidence thresholds, source provenance, and failure routing to avoid confident-but-thin responses.", url: "https://example.com/retrieval-grounding", serendipity: false },
  { title: "Evolutionary biology essay: cooperation signals in high-uncertainty groups", summary: "The article reviews experiments showing how costly signaling improves coordination when information quality is uneven.", url: "https://example.com/cooperation-signals", serendipity: true },
  { title: "What changed in web performance budgets for media-heavy pages", summary: "New benchmarks suggest stricter image and script ceilings to maintain acceptable interaction latency on mid-tier devices.", url: "https://example.com/perf-budgets-2026", serendipity: false },
  { title: "Why constrained curiosity can outperform broad consumption", summary: "A practical framework for selecting fewer high-signal sources while preserving serendipity through deliberate adjacency picks.", url: "https://example.com/constrained-curiosity", serendipity: false }
];

function renderItem(item, index, c) {
  const ser = item.serendipity
    ? `<p style="margin:0 0 8px; color:${c.ser}; font-size:12px;"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
    : "";
  return [
    `<section style="margin:0 0 14px; border:1px solid ${c.cardBorder}; background:${c.card}; border-radius:12px; padding:14px 16px;">`,
    `<h3 style="margin:0 0 8px; font-size:19px; line-height:1.35; font-family:'Cormorant Garamond', Georgia, serif; font-weight:600;">`,
    `<a href="${item.url}" style="color:${c.link}; text-decoration:underline; text-decoration-color:${c.deco}; text-decoration-thickness:2px; text-underline-offset:4px;">${index + 1}. ${item.title}</a>`,
    `</h3>`,
    ser,
    `<p style="margin:0 0 8px; line-height:1.6; color:${c.body}; font-size:15px;">${item.summary}</p>`,
    `<p style="margin:0;"><a href="${item.url}" style="color:${c.url}; font-size:13px;">${item.url}</a></p>`,
    `</section>`
  ].join("\n");
}

function render(v) {
  const list = items.map((item, index) => renderItem(item, index, v)).join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>No Circles Daily Brief - ${v.label}</title>`,
    "</head>",
    "<body style=\"margin:0; padding:24px; background:#ffffff;\">",
    `<div style=\"font-family:'Source Sans 3','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; background:${v.bg}; color:${v.body}; max-width:720px; margin:0 auto; padding:24px;\">`,
    `<div style=\"border:1px solid ${v.border}; background:${v.panel}; border-radius:18px; padding:20px;\">`,
    `<h2 style=\"margin:0 0 8px; font-family:'Cormorant Garamond',Georgia,serif; font-size:34px; line-height:1.15; color:${v.head};\">Hi Naman,</h2>`,
    `<p style=\"line-height:1.6; color:${v.body}; margin:0 0 14px;\">Here are your 10 curated links for today.</p>`,
    list,
    `<hr style=\"margin:24px 0; border:0; border-top:1px solid ${v.border};\"/>`,
    `<div style=\"margin:0 0 14px;\">`,
    `<p style=\"margin:0 0 8px; color:${v.quoteT}; font-size:26px; line-height:1.15; font-weight:700; font-family:'Segoe Script','Lucida Handwriting','Apple Chancery',cursive;\">Quote of the Day</p>`,
    `<blockquote style=\"margin:0 0 8px; color:${v.quoteB}; font-size:18px; line-height:1.55; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic;\">“Curiosity is the engine of achievement.”</blockquote>`,
    `<p style=\"margin:0; color:${v.quoteA}; font-size:13px;\">- Ken Robinson</p>`,
    `</div>`,
    `<p style=\"color:${v.foot}; font-size:14px; margin:0;\"><strong style=\"font-family:'Cambria Math',Cambria,Georgia,serif; font-size:20px; color:${v.reply};\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
    `</div>`,
    "</body>",
    "</html>"
  ].join("\n");
}

const outDir = join(process.cwd(), "reports", "email-color-variants-unique-harmonic");
mkdirSync(outDir, { recursive: true });
for (const v of variants) {
  writeFileSync(join(outDir, `${v.slug}.html`), render(v), "utf8");
}

const readme = [
  "# Unique + Harmonic Email Variants",
  "",
  "Rules:",
  "- Each file uses a distinct mood/family (clearly different across files)",
  "- Each file still uses a tight 3-color harmony internally",
  "- Role mapping is stable: base -> action -> accent",
  ""
];
for (const v of variants) {
  readme.push(`- ${v.label}: ${v.slug}.html`);
}
writeFileSync(join(outDir, "README.md"), readme.join("\n") + "\n", "utf8");

console.log(`Generated ${variants.length} unique-harmonic variants.`);
