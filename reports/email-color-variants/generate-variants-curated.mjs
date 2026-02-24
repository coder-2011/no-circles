import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const variants = [
  {
    slug: "01-emerald-apricot-cobalt",
    label: "Emerald Apricot Cobalt",
    baseBg: "#F6F8F4",
    panelBg: "#FEFFFC",
    panelBorder: "#D9E6DD",
    itemBg: "#F2F7FF",
    itemBorder: "#D6E4F7",
    heading: "#182223",
    body: "#334142",
    link: "#245FA7",
    linkDeco: "#E98E56",
    url: "#1E6F5C",
    serendipity: "#8A4A2D",
    quoteTitle: "#215C4C",
    quoteBody: "#263235",
    quoteAuthor: "#6A452F",
    footer: "#3C4A4C",
    replyAccent: "#1D6A58"
  },
  {
    slug: "02-pine-coral-royal",
    label: "Pine Coral Royal",
    baseBg: "#F5F8F6",
    panelBg: "#FEFFFD",
    panelBorder: "#D7E3DD",
    itemBg: "#F2F5FF",
    itemBorder: "#D8DFF5",
    heading: "#1A2324",
    body: "#344244",
    link: "#2F56A9",
    linkDeco: "#E17462",
    url: "#2C705A",
    serendipity: "#8D4034",
    quoteTitle: "#2A624F",
    quoteBody: "#283337",
    quoteAuthor: "#6D4237",
    footer: "#3D4A4D",
    replyAccent: "#246852"
  },
  {
    slug: "03-moss-melon-indigo",
    label: "Moss Melon Indigo",
    baseBg: "#F6F8F3",
    panelBg: "#FDFFFB",
    panelBorder: "#DAE5D8",
    itemBg: "#F3F4FF",
    itemBorder: "#DCDCFA",
    heading: "#1B2422",
    body: "#364240",
    link: "#3E4FA6",
    linkDeco: "#DB825F",
    url: "#3A6D4D",
    serendipity: "#884B34",
    quoteTitle: "#386347",
    quoteBody: "#2A3332",
    quoteAuthor: "#66473B",
    footer: "#414C4A",
    replyAccent: "#2E6646"
  },
  {
    slug: "04-jade-peach-sapphire",
    label: "Jade Peach Sapphire",
    baseBg: "#F3F8F7",
    panelBg: "#FCFFFE",
    panelBorder: "#D3E6E1",
    itemBg: "#EFF6FF",
    itemBorder: "#D4E2F7",
    heading: "#182425",
    body: "#324446",
    link: "#2D63AC",
    linkDeco: "#E79266",
    url: "#20756A",
    serendipity: "#8B5034",
    quoteTitle: "#20665A",
    quoteBody: "#263436",
    quoteAuthor: "#694A37",
    footer: "#3A4C4E",
    replyAccent: "#1E6F61"
  },
  {
    slug: "05-forest-salmon-ultramarine",
    label: "Forest Salmon Ultramarine",
    baseBg: "#F4F7F3",
    panelBg: "#FDFFFC",
    panelBorder: "#D6E1D4",
    itemBg: "#F0F3FF",
    itemBorder: "#D5DBF4",
    heading: "#1A2320",
    body: "#34403D",
    link: "#304DA4",
    linkDeco: "#D97168",
    url: "#356A4B",
    serendipity: "#85423A",
    quoteTitle: "#35604A",
    quoteBody: "#27322F",
    quoteAuthor: "#633F39",
    footer: "#3D4845",
    replyAccent: "#2F6647"
  },
  {
    slug: "06-spruce-apricot-deep-blue",
    label: "Spruce Apricot Deep Blue",
    baseBg: "#F3F7F6",
    panelBg: "#FCFFFD",
    panelBorder: "#D4E2DE",
    itemBg: "#EEF5FF",
    itemBorder: "#D2E0F6",
    heading: "#192426",
    body: "#324246",
    link: "#235EA6",
    linkDeco: "#E59761",
    url: "#1F6B5B",
    serendipity: "#884D35",
    quoteTitle: "#205C50",
    quoteBody: "#263337",
    quoteAuthor: "#674735",
    footer: "#3A4A4E",
    replyAccent: "#1F6658"
  },
  {
    slug: "07-olive-coral-navy",
    label: "Olive Coral Navy",
    baseBg: "#F7F8F3",
    panelBg: "#FFFFFC",
    panelBorder: "#DEE2D2",
    itemBg: "#F1F4FF",
    itemBorder: "#D8DCF3",
    heading: "#20241C",
    body: "#40453A",
    link: "#2C4C98",
    linkDeco: "#DC7665",
    url: "#5E6B33",
    serendipity: "#844339",
    quoteTitle: "#5A6436",
    quoteBody: "#303328",
    quoteAuthor: "#63413B",
    footer: "#4B4F43",
    replyAccent: "#566032"
  },
  {
    slug: "08-teal-cantaloupe-ink",
    label: "Teal Cantaloupe Ink",
    baseBg: "#F2F8F7",
    panelBg: "#FCFFFE",
    panelBorder: "#D2E7E1",
    itemBg: "#EFF4FF",
    itemBorder: "#D2DCF5",
    heading: "#182327",
    body: "#334248",
    link: "#2A4E9F",
    linkDeco: "#E59663",
    url: "#1F726B",
    serendipity: "#875137",
    quoteTitle: "#1F6761",
    quoteBody: "#26333A",
    quoteAuthor: "#684938",
    footer: "#3B4A50",
    replyAccent: "#1D6962"
  },
  {
    slug: "09-seaweed-blush-royal",
    label: "Seaweed Blush Royal",
    baseBg: "#F3F7F4",
    panelBg: "#FDFFFD",
    panelBorder: "#D5E2D9",
    itemBg: "#F0F2FF",
    itemBorder: "#D7DAF5",
    heading: "#19231F",
    body: "#34403D",
    link: "#344EA4",
    linkDeco: "#D88978",
    url: "#2D6A53",
    serendipity: "#7E4A40",
    quoteTitle: "#2E604D",
    quoteBody: "#27312F",
    quoteAuthor: "#61443E",
    footer: "#3C4744",
    replyAccent: "#2B644F"
  },
  {
    slug: "10-cedar-peach-cornflower",
    label: "Cedar Peach Cornflower",
    baseBg: "#F4F8F5",
    panelBg: "#FEFFFD",
    panelBorder: "#D8E3DB",
    itemBg: "#F1F5FF",
    itemBorder: "#D8E1F7",
    heading: "#1A231F",
    body: "#36403D",
    link: "#3660AC",
    linkDeco: "#E39A73",
    url: "#356A53",
    serendipity: "#8A553D",
    quoteTitle: "#376050",
    quoteBody: "#283230",
    quoteAuthor: "#684B40",
    footer: "#3D4745",
    replyAccent: "#2F644F"
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

function renderItem(item, index, c) {
  const serendipityNote = item.serendipity
    ? `<p style="margin:0 0 8px; color:${c.serendipity}; font-size:12px;"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
    : "";

  return [
    `<section style="margin:0 0 14px; border:1px solid ${c.itemBorder}; background:${c.itemBg}; border-radius:12px; padding:14px 16px;">`,
    `<h3 style="margin:0 0 8px; font-size:19px; line-height:1.35; font-family:'Cormorant Garamond', Georgia, serif; font-weight:600;">`,
    `<a href="${item.url}" style="color:${c.link}; text-decoration:underline; text-decoration-color:${c.linkDeco}; text-decoration-thickness:2px; text-underline-offset:4px;">${index + 1}. ${item.title}</a>`,
    `</h3>`,
    serendipityNote,
    `<p style="margin:0 0 8px; line-height:1.6; color:${c.body}; font-size:15px;">${item.summary}</p>`,
    `<p style="margin:0;"><a href="${item.url}" style="color:${c.url}; font-size:13px;">${item.url}</a></p>`,
    `</section>`
  ].join("\n");
}

function renderVariant(v) {
  const itemsHtml = items.map((item, index) => renderItem(item, index, v)).join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>No Circles Daily Brief - ${v.label}</title>`,
    "</head>",
    "<body style=\"margin:0; padding:24px; background:#ffffff;\">",
    `<div style=\"font-family:'Source Sans 3','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; background:${v.baseBg}; color:${v.body}; max-width:720px; margin:0 auto; padding:24px;\">`,
    `<div style=\"border:1px solid ${v.panelBorder}; background:${v.panelBg}; border-radius:18px; padding:20px;\">`,
    `<h2 style=\"margin:0 0 8px; font-family:'Cormorant Garamond',Georgia,serif; font-size:34px; line-height:1.15; color:${v.heading};\">Hi Naman,</h2>`,
    `<p style=\"line-height:1.6; color:${v.body}; margin:0 0 14px;\">Here are your 10 curated links for today.</p>`,
    itemsHtml,
    `<hr style=\"margin:24px 0; border:0; border-top:1px solid ${v.panelBorder};\"/>`,
    `<div style=\"margin:0 0 14px;\">`,
    `<p style=\"margin:0 0 8px; color:${v.quoteTitle}; font-size:26px; line-height:1.15; font-weight:700; font-family:'Segoe Script','Lucida Handwriting','Apple Chancery',cursive;\">Quote of the Day</p>`,
    `<blockquote style=\"margin:0 0 8px; color:${v.quoteBody}; font-size:18px; line-height:1.55; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic;\">“Curiosity is the engine of achievement.”</blockquote>`,
    `<p style=\"margin:0; color:${v.quoteAuthor}; font-size:13px;\">- Ken Robinson</p>`,
    `</div>`,
    `<p style=\"color:${v.footer}; font-size:14px; margin:0;\"><strong style=\"font-family:'Cambria Math',Cambria,Georgia,serif; font-size:20px; color:${v.replyAccent};\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
    `</div>`,
    "</body>",
    "</html>"
  ].join("\n");
}

const outDir = join(process.cwd(), "reports", "email-color-variants-curated");
mkdirSync(outDir, { recursive: true });

for (const variant of variants) {
  writeFileSync(join(outDir, `${variant.slug}.html`), renderVariant(variant), "utf8");
}

const readme = [
  "# Curated Email Color Variants",
  "",
  "Visual system:",
  "- Shared neutral canvas and typography for consistency",
  "- 3-color family per variant: botanical base, warm decorative accent, cool link/action hue",
  "- Deliberately limited chroma so it feels vivid but not noisy",
  ""
];
for (const variant of variants) {
  readme.push(`- ${variant.label}: ${variant.slug}.html`);
}
writeFileSync(join(outDir, "README.md"), readme.join("\n") + "\n", "utf8");

console.log(`Generated ${variants.length} curated variants.`);
