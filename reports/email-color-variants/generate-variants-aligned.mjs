import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const variants = [
  { slug: "01-verdant-clay-river", label: "Verdant Clay River", anchor: "#2F8F66", support: "#B66A4A", accent: "#3D79C2" },
  { slug: "02-moss-terracotta-bay", label: "Moss Terracotta Bay", anchor: "#3B8A5A", support: "#BC6F45", accent: "#2E82B8" },
  { slug: "03-pine-copper-lake", label: "Pine Copper Lake", anchor: "#2E8658", support: "#B66A3F", accent: "#417DBA" },
  { slug: "04-jade-brick-harbor", label: "Jade Brick Harbor", anchor: "#2F8D73", support: "#B85E4E", accent: "#3E78B8" },
  { slug: "05-cedar-amber-stream", label: "Cedar Amber Stream", anchor: "#3A8650", support: "#B8793E", accent: "#3F74BE" },
  { slug: "06-fern-rust-cove", label: "Fern Rust Cove", anchor: "#418A63", support: "#B76447", accent: "#3A81B5" },
  { slug: "07-grove-canyon-current", label: "Grove Canyon Current", anchor: "#2E8B5C", support: "#B86C4A", accent: "#357FC4" },
  { slug: "08-sage-clay-tide", label: "Sage Clay Tide", anchor: "#458C6A", support: "#B56A4E", accent: "#4178B6" },
  { slug: "09-olive-copper-channel", label: "Olive Copper Channel", anchor: "#4B8758", support: "#B77445", accent: "#3E7DBF" },
  { slug: "10-thicket-ember-inlet", label: "Thicket Ember Inlet", anchor: "#3A8B62", support: "#B65F43", accent: "#3F79BA" }
];

const items = [
  {
    title: "Anthropic ships compact model upgrades for lower-latency reasoning",
    summary: "Anthropic announced updates focused on faster response times and improved instruction-following in lightweight deployments, with clearer guidance on when to use each model tier.",
    url: "https://example.com/ai-model-upgrades",
    serendipity: false
  },
  {
    title: "SQLite team outlines practical patterns for durable edge sync",
    summary: "The post compares several replication topologies and shows concrete conflict-resolution tradeoffs for teams running partially connected clients.",
    url: "https://example.com/sqlite-edge-sync",
    serendipity: false
  },
  {
    title: "A new long-read on Renaissance workshop systems and idea transfer",
    summary: "Historians trace how apprenticeships and material constraints shaped innovation cycles, with parallels to modern maker ecosystems.",
    url: "https://example.com/renaissance-workshops",
    serendipity: true
  },
  {
    title: "How one bio lab cut experiment cycle time by redesigning note flow",
    summary: "The team reduced repeat setup mistakes by moving from ad hoc docs to structured templates tied directly to instrument checkpoints.",
    url: "https://example.com/lab-note-flow",
    serendipity: false
  },
  {
    title: "A field report on AI-assisted code review quality at scale",
    summary: "Engineers measured where assistant comments improved merge confidence and where human review remained essential for system-level correctness.",
    url: "https://example.com/ai-code-review",
    serendipity: false
  },
  {
    title: "Urban history map reveals hidden trade routes behind modern tech hubs",
    summary: "Researchers connect legacy rail and port infrastructure to present-day startup geography, arguing historical logistics still shape talent density.",
    url: "https://example.com/urban-history-tech-hubs",
    serendipity: true
  },
  {
    title: "Pragmatic guide: keeping retrieval pipelines grounded under pressure",
    summary: "The guide focuses on confidence thresholds, source provenance, and failure routing so teams can avoid confident-but-thin responses.",
    url: "https://example.com/retrieval-grounding",
    serendipity: false
  },
  {
    title: "Evolutionary biology essay: cooperation signals in high-uncertainty groups",
    summary: "The article reviews experiments showing how costly signaling can improve group coordination when information quality is uneven.",
    url: "https://example.com/cooperation-signals",
    serendipity: true
  },
  {
    title: "What changed in web performance budgets for media-heavy pages",
    summary: "New benchmarks suggest stricter image and script ceilings are now needed to stay within acceptable interaction latency on mid-tier devices.",
    url: "https://example.com/perf-budgets-2026",
    serendipity: false
  },
  {
    title: "Essay: why constrained curiosity can outperform broad consumption",
    summary: "A practical framework for selecting fewer, higher-signal sources while preserving serendipity through deliberate adjacency picks.",
    url: "https://example.com/constrained-curiosity",
    serendipity: false
  }
];

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${c(r).toString(16).padStart(2, "0")}${c(g).toString(16).padStart(2, "0")}${c(b).toString(16).padStart(2, "0")}`;
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const p = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * p,
    g: a.g + (b.g - a.g) * p,
    b: a.b + (b.b - a.b) * p
  });
}

function buildRoles(v) {
  return {
    outerBg: mix(v.anchor, "#FFFFFF", 0.9),
    panelBg: mix(v.anchor, "#FFFFFF", 0.95),
    panelBorder: mix(v.support, "#FFFFFF", 0.45),
    heading: "#1F252B",
    body: "#313A43",
    itemBg: mix(v.accent, "#FFFFFF", 0.92),
    itemBorder: mix(v.accent, "#FFFFFF", 0.58),
    link: mix(v.accent, "#0F1824", 0.22),
    linkDeco: mix(v.support, "#FFFFFF", 0.08),
    url: mix(v.anchor, "#111111", 0.34),
    serendipity: mix(v.support, "#222222", 0.18),
    quoteTitle: mix(v.anchor, "#18222D", 0.3),
    quoteBody: "#272F38",
    quoteAuthor: mix(v.support, "#121212", 0.36),
    footer: "#3D4650",
    replyAccent: mix(v.anchor, "#0E3F31", 0.48)
  };
}

function renderItem(item, i, c) {
  const serendipity = item.serendipity
    ? `<p style="margin:0 0 8px; color:${c.serendipity}; font-size:12px;"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
    : "";
  return [
    `<section style="margin:0 0 14px; border:1px solid ${c.itemBorder}; background:${c.itemBg}; border-radius:12px; padding:14px 16px;">`,
    `<h3 style="margin:0 0 8px; font-size:19px; line-height:1.35; font-family:'Cormorant Garamond', Georgia, serif; font-weight:600;">`,
    `<a href="${item.url}" style="color:${c.link}; text-decoration:underline; text-decoration-color:${c.linkDeco}; text-decoration-thickness:2px; text-underline-offset:4px;">${i + 1}. ${item.title}</a>`,
    `</h3>`,
    serendipity,
    `<p style="margin:0 0 8px; line-height:1.6; color:${c.body}; font-size:15px;">${item.summary}</p>`,
    `<p style="margin:0;"><a href="${item.url}" style="color:${c.url}; font-size:13px;">${item.url}</a></p>`,
    `</section>`
  ].join("\n");
}

function renderVariant(v) {
  const c = buildRoles(v);
  const itemHtml = items.map((item, i) => renderItem(item, i, c)).join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>No Circles Daily Brief - ${v.label}</title>`,
    "</head>",
    "<body style=\"margin:0; padding:24px; background:#ffffff;\">",
    `<div style=\"font-family:'Source Sans 3','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; background:${c.outerBg}; color:${c.link}; max-width:720px; margin:0 auto; padding:24px;\">`,
    `<div style=\"border:1px solid ${c.panelBorder}; background:${c.panelBg}; border-radius:18px; padding:20px;\">`,
    `<h2 style=\"margin:0 0 8px; font-family:'Cormorant Garamond',Georgia,serif; font-size:34px; line-height:1.15; color:${c.heading};\">Hi Naman,</h2>`,
    `<p style=\"line-height:1.6; color:${c.body}; margin:0 0 14px;\">Here are your 10 curated links for today.</p>`,
    itemHtml,
    `<hr style=\"margin:24px 0; border:0; border-top:1px solid ${c.panelBorder};\"/>`,
    `<div style=\"margin:0 0 14px;\">`,
    `<p style=\"margin:0 0 8px; color:${c.quoteTitle}; font-size:26px; line-height:1.15; font-weight:700; font-family:'Segoe Script','Lucida Handwriting','Apple Chancery',cursive;\">Quote of the Day</p>`,
    `<blockquote style=\"margin:0 0 8px; color:${c.quoteBody}; font-size:18px; line-height:1.55; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic;\">“Curiosity is the engine of achievement.”</blockquote>`,
    `<p style=\"margin:0; color:${c.quoteAuthor}; font-size:13px;\">- Ken Robinson</p>`,
    `</div>`,
    `<p style=\"color:${c.footer}; font-size:14px; margin:0;\"><strong style=\"font-family:'Cambria Math',Cambria,Georgia,serif; font-size:20px; color:${c.replyAccent};\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
    `</div>`,
    "</body>",
    "</html>"
  ].join("\n");
}

const outDir = join(process.cwd(), "reports", "email-color-variants-aligned");
mkdirSync(outDir, { recursive: true });
for (const v of variants) {
  writeFileSync(join(outDir, `${v.slug}.html`), renderVariant(v), "utf8");
}

const readme = [
  "# Aligned Email Color Variants",
  "",
  "Design rules:",
  "- Fixed role hierarchy: anchor (base), support (warm contrast), accent (cool action)",
  "- Constant neutral text tones for readability",
  "- Controlled tint percentages to keep cross-variant consistency",
  ""
];
for (const v of variants) {
  readme.push(`- ${v.label}: ${v.slug}.html`);
}
writeFileSync(join(outDir, "README.md"), readme.join("\n") + "\n", "utf8");

console.log(`Generated ${variants.length} aligned variants.`);
