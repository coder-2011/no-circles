import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const variants = [
  { slug: "01-forest-clay-ocean", label: "Forest Clay Ocean", hue: 150 },
  { slug: "02-pine-terra-bay", label: "Pine Terra Bay", hue: 158 },
  { slug: "03-fern-copper-river", label: "Fern Copper River", hue: 166 },
  { slug: "04-jade-rust-harbor", label: "Jade Rust Harbor", hue: 174 },
  { slug: "05-moss-amber-channel", label: "Moss Amber Channel", hue: 182 },
  { slug: "06-grove-brick-inlet", label: "Grove Brick Inlet", hue: 190 },
  { slug: "07-cedar-clay-tide", label: "Cedar Clay Tide", hue: 198 },
  { slug: "08-thicket-copper-stream", label: "Thicket Copper Stream", hue: 206 },
  { slug: "09-olive-terra-cove", label: "Olive Terra Cove", hue: 214 },
  { slug: "10-sage-rust-current", label: "Sage Rust Current", hue: 222 }
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

function hsl(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}

function toRgbFromHsl(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function relLum({ r, g, b }) {
  const n = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
}

function contrastRatio(hslA, hslB) {
  const parse = (value) => {
    const match = value.match(/hsl\(([^ ]+) ([^%]+)% ([^%]+)%\)/);
    if (!match) return { r: 0, g: 0, b: 0 };
    return toRgbFromHsl(Number(match[1]), Number(match[2]), Number(match[3]));
  };
  const a = relLum(parse(hslA));
  const b = relLum(parse(hslB));
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function palette(baseHue) {
  const anchorHue = baseHue;
  const supportHue = (baseHue + 28) % 360;
  const accentHue = (baseHue + 205) % 360;

  const colors = {
    outerBg: hsl(anchorHue, 42, 95),
    panelBg: hsl(anchorHue, 38, 98),
    panelBorder: hsl(supportHue, 38, 78),
    itemBg: hsl(accentHue, 42, 95),
    itemBorder: hsl(accentHue, 40, 82),
    heading: hsl(215, 21, 16),
    body: hsl(215, 16, 24),
    link: hsl(accentHue, 68, 26),
    linkDeco: hsl(supportHue, 58, 48),
    url: hsl(anchorHue, 52, 28),
    serendipity: hsl(supportHue, 46, 34),
    quoteTitle: hsl(anchorHue, 46, 30),
    quoteBody: hsl(215, 15, 20),
    quoteAuthor: hsl(supportHue, 45, 28),
    footer: hsl(215, 12, 30),
    replyAccent: hsl(anchorHue, 56, 33)
  };

  const bodyOnPanel = contrastRatio(colors.body, colors.panelBg);
  const linkOnItem = contrastRatio(colors.link, colors.itemBg);
  if (bodyOnPanel < 7 || linkOnItem < 4.5) {
    throw new Error(`Contrast guard failed at hue ${baseHue}: body=${bodyOnPanel.toFixed(2)}, link=${linkOnItem.toFixed(2)}`);
  }

  return colors;
}

function renderItem(item, index, c) {
  const serendipity = item.serendipity
    ? `<p style="margin:0 0 8px; color:${c.serendipity}; font-size:12px;"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
    : "";

  return [
    `<section style="margin:0 0 14px; border:1px solid ${c.itemBorder}; background:${c.itemBg}; border-radius:12px; padding:14px 16px;">`,
    `<h3 style="margin:0 0 8px; font-size:19px; line-height:1.35; font-family:'Cormorant Garamond', Georgia, serif; font-weight:600;">`,
    `<a href="${item.url}" style="color:${c.link}; text-decoration:underline; text-decoration-color:${c.linkDeco}; text-decoration-thickness:2px; text-underline-offset:4px;">${index + 1}. ${item.title}</a>`,
    `</h3>`,
    serendipity,
    `<p style="margin:0 0 8px; line-height:1.6; color:${c.body}; font-size:15px;">${item.summary}</p>`,
    `<p style="margin:0;"><a href="${item.url}" style="color:${c.url}; font-size:13px;">${item.url}</a></p>`,
    `</section>`
  ].join("\n");
}

function renderVariant(v) {
  const c = palette(v.hue);
  const itemHtml = items.map((item, index) => renderItem(item, index, c)).join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>No Circles Daily Brief - ${v.label}</title>`,
    "</head>",
    "<body style=\"margin:0; padding:24px; background:#ffffff;\">",
    `<div style=\"font-family:'Source Sans 3','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; background:${c.outerBg}; color:${c.body}; max-width:720px; margin:0 auto; padding:24px;\">`,
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

const outDir = join(process.cwd(), "reports", "email-color-variants-harmonic");
mkdirSync(outDir, { recursive: true });

for (const v of variants) {
  writeFileSync(join(outDir, `${v.slug}.html`), renderVariant(v), "utf8");
}

const readme = [
  "# Harmonic Email Color Variants",
  "",
  "Palette system (constant across all 10):",
  "- Anchor hue drives background + reply accent",
  "- Support hue (anchor + 28deg) drives warm border/decorative tone",
  "- Accent hue (anchor + 205deg) drives link/action surfaces",
  "- Lightness/saturation ladder is fixed for structural alignment",
  "- Contrast guards: body>=7:1 on panel, links>=4.5:1 on item cards",
  ""
];

for (const v of variants) {
  readme.push(`- ${v.label}: ${v.slug}.html`);
}

writeFileSync(join(outDir, "README.md"), readme.join("\n") + "\n", "utf8");
console.log(`Generated ${variants.length} harmonic variants.`);
