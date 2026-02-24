import { writeFileSync } from "node:fs";
import { join } from "node:path";

const variants = [
  {
    slug: "01-lime-coral-sky",
    label: "Lime Coral Sky",
    trio: ["#5CBF7A", "#F06A6A", "#4C9BFF"]
  },
  {
    slug: "02-gold-teal-berry",
    label: "Gold Teal Berry",
    trio: ["#E3A93C", "#16A9A3", "#C85688"]
  },
  {
    slug: "03-mint-amber-indigo",
    label: "Mint Amber Indigo",
    trio: ["#39B88A", "#E08D2F", "#5563D6"]
  },
  {
    slug: "04-tangerine-ocean-plum",
    label: "Tangerine Ocean Plum",
    trio: ["#EB7A34", "#2F9EC6", "#8A54B8"]
  },
  {
    slug: "05-apple-sunrise-cobalt",
    label: "Apple Sunrise Cobalt",
    trio: ["#63B24D", "#D77541", "#3D74D8"]
  },
  {
    slug: "06-jade-marigold-rose",
    label: "Jade Marigold Rose",
    trio: ["#1EA183", "#D79A2C", "#C7506F"]
  },
  {
    slug: "07-aqua-rust-violet",
    label: "Aqua Rust Violet",
    trio: ["#22A5B6", "#C76B3A", "#7D59C6"]
  },
  {
    slug: "08-moss-poppy-azure",
    label: "Moss Poppy Azure",
    trio: ["#6BA247", "#D85461", "#3E90D9"]
  },
  {
    slug: "09-pine-amber-iris",
    label: "Pine Amber Iris",
    trio: ["#2D9A67", "#C78A2E", "#6E65D5"]
  },
  {
    slug: "10-lagoon-copper-orchid",
    label: "Lagoon Copper Orchid",
    trio: ["#2598A8", "#BA6A3E", "#A05BC6"]
  }
];

const items = [
  {
    title: "Anthropic ships compact model upgrades for lower-latency reasoning",
    summary:
      "Anthropic announced updates focused on faster response times and improved instruction-following in lightweight deployments, with clearer guidance on when to use each model tier.",
    url: "https://example.com/ai-model-upgrades",
    serendipity: false
  },
  {
    title: "SQLite team outlines practical patterns for durable edge sync",
    summary:
      "The post compares several replication topologies and shows concrete conflict-resolution tradeoffs for teams running partially connected clients.",
    url: "https://example.com/sqlite-edge-sync",
    serendipity: false
  },
  {
    title: "A new long-read on Renaissance workshop systems and idea transfer",
    summary:
      "Historians trace how apprenticeships and material constraints shaped innovation cycles, with parallels to modern maker ecosystems.",
    url: "https://example.com/renaissance-workshops",
    serendipity: true
  },
  {
    title: "How one bio lab cut experiment cycle time by redesigning note flow",
    summary:
      "The team reduced repeat setup mistakes by moving from ad hoc docs to structured templates tied directly to instrument checkpoints.",
    url: "https://example.com/lab-note-flow",
    serendipity: false
  },
  {
    title: "A field report on AI-assisted code review quality at scale",
    summary:
      "Engineers measured where assistant comments improved merge confidence and where human review remained essential for system-level correctness.",
    url: "https://example.com/ai-code-review",
    serendipity: false
  },
  {
    title: "Urban history map reveals hidden trade routes behind modern tech hubs",
    summary:
      "Researchers connect legacy rail and port infrastructure to present-day startup geography, arguing historical logistics still shape talent density.",
    url: "https://example.com/urban-history-tech-hubs",
    serendipity: true
  },
  {
    title: "Pragmatic guide: keeping retrieval pipelines grounded under pressure",
    summary:
      "The guide focuses on confidence thresholds, source provenance, and failure routing so teams can avoid confident-but-thin responses.",
    url: "https://example.com/retrieval-grounding",
    serendipity: false
  },
  {
    title: "Evolutionary biology essay: cooperation signals in high-uncertainty groups",
    summary:
      "The article reviews experiments showing how costly signaling can improve group coordination when information quality is uneven.",
    url: "https://example.com/cooperation-signals",
    serendipity: true
  },
  {
    title: "What changed in web performance budgets for media-heavy pages",
    summary:
      "New benchmarks suggest stricter image and script ceilings are now needed to stay within acceptable interaction latency on mid-tier devices.",
    url: "https://example.com/perf-budgets-2026",
    serendipity: false
  },
  {
    title: "Essay: why constrained curiosity can outperform broad consumption",
    summary:
      "A practical framework for selecting fewer, higher-signal sources while preserving serendipity through deliberate adjacency picks.",
    url: "https://example.com/constrained-curiosity",
    serendipity: false
  }
];

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b)
    .toString(16)
    .padStart(2, "0")}`;
}

function mix(hexA, hexB, ratio) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const t = Math.max(0, Math.min(1, ratio));
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}

function roleColors(trio, index) {
  const shift = index % 3;
  const baseA = trio[shift];
  const baseB = trio[(shift + 1) % 3];
  const baseC = trio[(shift + 2) % 3];
  return {
    outerBg: mix(baseA, "#FFFFFF", 0.85),
    panelBorder: mix(baseB, "#FFFFFF", 0.5),
    panelBg: mix(baseA, "#FFFFFF", 0.92),
    itemBorder: mix(baseC, "#FFFFFF", 0.52),
    itemBg: mix(baseC, "#FFFFFF", 0.9),
    heading: "#20252A",
    body: "#313A42",
    link: mix(baseC, "#111111", 0.24),
    linkDeco: mix(baseB, "#FFFFFF", 0.15),
    url: mix(baseA, "#1A1A1A", 0.3),
    serendipity: mix(baseB, "#1A1A1A", 0.25),
    quoteTitle: mix(baseA, "#111111", 0.2),
    quoteBody: "#2A3036",
    quoteAuthor: mix(baseB, "#111111", 0.35),
    footer: "#38414A",
    replyAccent: mix(baseA, "#0E3A2E", 0.4)
  };
}

function renderItem(item, index, colors) {
  const serendipityNote = item.serendipity
    ? `<p style="margin: 0 0 8px; color: ${colors.serendipity}; font-size: 12px;"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
    : "";

  return [
    `<section style="margin: 0 0 14px; border: 1px solid ${colors.itemBorder}; background: ${colors.itemBg}; border-radius: 12px; padding: 14px 16px;">`,
    `<h3 style="margin: 0 0 8px; font-size: 19px; line-height: 1.35; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;">`,
    `<a href="${item.url}" style="color: ${colors.link}; text-decoration: underline; text-decoration-color: ${colors.linkDeco}; text-decoration-thickness: 2px; text-underline-offset: 4px;">${index + 1}. ${item.title}</a>`,
    `</h3>`,
    serendipityNote,
    `<p style="margin: 0 0 8px; line-height: 1.6; color: ${colors.body}; font-size: 15px;">${item.summary}</p>`,
    `<p style="margin: 0;"><a href="${item.url}" style="color: ${colors.url}; font-size: 13px;">${item.url}</a></p>`,
    `</section>`
  ].join("\n");
}

function renderHtml(variant, index) {
  const colors = roleColors(variant.trio, index);
  const itemHtml = items.map((item, itemIndex) => renderItem(item, itemIndex, colors)).join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>No Circles Daily Brief - ${variant.label}</title>`,
    "</head>",
    "<body style=\"margin:0; padding:24px; background:#ffffff;\">",
    `<div style=\"font-family: 'Source Sans 3', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: ${colors.outerBg}; color: ${colors.link}; max-width: 720px; margin: 0 auto; padding: 24px;\">`,
    `<div style=\"border: 1px solid ${colors.panelBorder}; background: ${colors.panelBg}; border-radius: 18px; padding: 20px;\">`,
    `<h2 style=\"margin: 0 0 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34px; line-height: 1.15; color: ${colors.heading};\">Hi Naman,</h2>`,
    `<p style=\"line-height: 1.6; color: ${colors.body}; margin: 0 0 14px;\">Here are your 10 curated links for today.</p>`,
    itemHtml,
    `<hr style=\"margin: 24px 0; border: 0; border-top: 1px solid ${colors.panelBorder};\"/>`,
    `<div style=\"margin: 0 0 14px;\">`,
    `<p style=\"margin: 0 0 8px; color: ${colors.quoteTitle}; font-size: 26px; line-height: 1.15; font-weight: 700; font-family: 'Segoe Script', 'Lucida Handwriting', 'Apple Chancery', cursive;\">Quote of the Day</p>`,
    `<blockquote style=\"margin: 0 0 8px; color: ${colors.quoteBody}; font-size: 18px; line-height: 1.55; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic;\">“Curiosity is the engine of achievement.”</blockquote>`,
    `<p style=\"margin: 0; color: ${colors.quoteAuthor}; font-size: 13px;\">- Ken Robinson</p>`,
    `</div>`,
    `<p style=\"color: ${colors.footer}; font-size: 14px; margin: 0;\"><strong style=\"font-family: 'Cambria Math', Cambria, Georgia, serif; font-size: 20px; color: ${colors.replyAccent};\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
    `</div>`,
    "</body>",
    "</html>"
  ].join("\n");
}

for (let i = 0; i < variants.length; i += 1) {
  const variant = variants[i];
  const html = renderHtml(variant, i);
  const filePath = join(process.cwd(), "reports", "email-color-variants", `${variant.slug}.html`);
  writeFileSync(filePath, html, "utf8");
}

const manifestPath = join(process.cwd(), "reports", "email-color-variants", "README.md");
const lines = [
  "# Email Color Variants",
  "",
  "Generated sample daily-email variants using vibrant tri-color palettes with rotated role mapping:",
  ""
];
for (const variant of variants) {
  lines.push(`- ${variant.label}: ${variant.slug}.html`);
}
writeFileSync(manifestPath, lines.join("\n") + "\n", "utf8");

console.log(`Generated ${variants.length} variant HTML files.`);
