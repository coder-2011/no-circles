const DEFAULT_MAX_CHARACTERS = 1500;
const DEFAULT_TIMEOUT_MS = 5000;
const MIN_EXCERPT_CHARACTERS = 160;

export type UrlSnapshot = {
  finalUrl: string;
  status: number;
  contentType: string | null;
  html: string | null;
  excerpt: string | null;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  const withoutNoise = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const articleMatch = withoutNoise.match(/<article[\s\S]*?<\/article>/i);
  const candidate = articleMatch ? articleMatch[0] : withoutNoise;

  return normalizeWhitespace(decodeHtmlEntities(candidate.replace(/<[^>]+>/g, " ")));
}

function buildTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

export async function fetchUrlExcerpt(args: {
  url: string;
  maxCharacters?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const maxCharacters = Math.max(200, Math.floor(args.maxCharacters ?? DEFAULT_MAX_CHARACTERS));
  const timeoutMs = Math.max(500, Math.floor(args.timeoutMs ?? DEFAULT_TIMEOUT_MS));

  let response: Response;
  try {
    response = await fetch(args.url, {
      method: "GET",
      redirect: "follow",
      signal: buildTimeoutSignal(timeoutMs),
      headers: {
        "user-agent":
          "NoCirclesBot/1.0 (+https://nocircles.local; discovery excerpt fetch)"
      }
    });
  } catch {
    return null;
  }

  const snapshot = await buildSnapshotFromResponse(response, maxCharacters);
  return snapshot?.excerpt ?? null;
}

async function buildSnapshotFromResponse(response: Response, maxCharacters: number): Promise<UrlSnapshot | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? null;
  if (!response.ok || !contentType?.includes("text/html")) {
    return {
      finalUrl: response.url,
      status: response.status,
      contentType,
      html: null,
      excerpt: null
    };
  }

  const html = await response.text().catch(() => null);
  if (!html) {
    return {
      finalUrl: response.url,
      status: response.status,
      contentType,
      html: null,
      excerpt: null
    };
  }

  const text = stripHtml(html);
  const excerpt = text.length >= MIN_EXCERPT_CHARACTERS ? text.slice(0, maxCharacters).trim() : null;

  return {
    finalUrl: response.url,
    status: response.status,
    contentType,
    html,
    excerpt
  };
}

export async function fetchUrlSnapshot(args: {
  url: string;
  maxCharacters?: number;
  timeoutMs?: number;
}): Promise<UrlSnapshot | null> {
  const maxCharacters = Math.max(200, Math.floor(args.maxCharacters ?? DEFAULT_MAX_CHARACTERS));
  const timeoutMs = Math.max(500, Math.floor(args.timeoutMs ?? DEFAULT_TIMEOUT_MS));

  let response: Response;
  try {
    response = await fetch(args.url, {
      method: "GET",
      redirect: "follow",
      signal: buildTimeoutSignal(timeoutMs),
      headers: {
        "user-agent":
          "NoCirclesBot/1.0 (+https://nocircles.local; discovery excerpt fetch)"
      }
    });
  } catch {
    return null;
  }

  return buildSnapshotFromResponse(response, maxCharacters);
}
