type ProviderLevel = "ok" | "warn" | "error" | "unavailable";

export type ProviderSnapshot = {
  provider: "anthropic" | "exa" | "deepgram" | "resend" | "perplexity";
  level: ProviderLevel;
  summary: string;
  usageSummary: string | null;
  costSummary: string | null;
  details: string[];
};

type ProviderCheckWindow = {
  now: Date;
  dayStartUtc: Date;
  monthStartUtc: Date;
  nextDayUtc: Date;
};

type ThresholdConfig = {
  anthropicDailyWarnUsd: number | null;
  exaMonthlyWarnUsd: number | null;
  deepgramDailyWarnUsd: number | null;
  deepgramBalanceWarnUsd: number | null;
  resendDailyQuotaLimit: number | null;
  resendMonthlyQuotaLimit: number | null;
  resendQuotaWarnRatio: number;
};

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/v1/organizations/usage_report/messages";
const ANTHROPIC_COST_URL = "https://api.anthropic.com/v1/organizations/cost_report";
const EXA_ADMIN_API_BASE = "https://admin-api.exa.ai/team-management";
const DEEPGRAM_API_BASE = "https://api.deepgram.com/v1/projects";
const RESEND_API_BASE = "https://api.resend.com";

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatUsd(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatCount(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function readNumberEnv(name: string): number | null {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getThresholdConfig(): ThresholdConfig {
  return {
    anthropicDailyWarnUsd: readNumberEnv("ANTHROPIC_DAILY_COST_WARN_USD"),
    exaMonthlyWarnUsd: readNumberEnv("EXA_MONTHLY_COST_WARN_USD"),
    deepgramDailyWarnUsd: readNumberEnv("DEEPGRAM_DAILY_COST_WARN_USD"),
    deepgramBalanceWarnUsd: readNumberEnv("DEEPGRAM_BALANCE_WARN_USD"),
    resendDailyQuotaLimit: readNumberEnv("RESEND_DAILY_QUOTA_LIMIT"),
    resendMonthlyQuotaLimit: readNumberEnv("RESEND_MONTHLY_QUOTA_LIMIT"),
    resendQuotaWarnRatio: readNumberEnv("RESEND_QUOTA_WARN_RATIO") ?? 0.8
  };
}

function getWindow(now = new Date()): ProviderCheckWindow {
  const dayStartUtc = toUtcMidnight(now);
  const monthStartUtc = startOfUtcMonth(now);
  const nextDayUtc = addUtcDays(dayStartUtc, 1);
  return { now, dayStartUtc, monthStartUtc, nextDayUtc };
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sumUsdAmounts(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + sumUsdAmounts(item), 0);
  }

  if (!value || typeof value !== "object") {
    return 0;
  }

  const record = value as Record<string, unknown>;
  let total = 0;

  if (typeof record.currency === "string" && record.currency.toLowerCase() === "usd") {
    const numeric = parseNumber(record.value);
    if (numeric !== null) {
      total += numeric;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (["value", "currency"].includes(key)) {
      continue;
    }

    if (/(cost|amount|usd|dollar|price)/i.test(key)) {
      const numeric = parseNumber(child);
      if (numeric !== null) {
        total += numeric;
        continue;
      }
    }

    total += sumUsdAmounts(child);
  }

  return total;
}

function sumMatchingNumbers(value: unknown, matcher: RegExp): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + sumMatchingNumbers(item, matcher), 0);
  }

  if (!value || typeof value !== "object") {
    return 0;
  }

  let total = 0;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (matcher.test(key)) {
      const numeric = parseNumber(child);
      if (numeric !== null) {
        total += numeric;
        continue;
      }
    }

    total += sumMatchingNumbers(child, matcher);
  }

  return total;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function fetchJson(args: {
  url: string;
  method?: string;
  headers: Record<string, string>;
}): Promise<{ response: Response; json: unknown }> {
  const response = await fetch(args.url, {
    method: args.method ?? "GET",
    headers: args.headers,
    cache: "no-store"
  });

  const json = await parseJson(response);
  if (!response.ok) {
    throw new Error(`${new URL(args.url).hostname.toUpperCase()}_HTTP_${response.status}`);
  }

  return { response, json };
}

function buildAnthropicSnapshot(args: {
  dailyCostUsd: number | null;
  dailyTokens: number | null;
  details: string[];
  thresholds: ThresholdConfig;
}): ProviderSnapshot {
  const { dailyCostUsd, dailyTokens, thresholds, details } = args;
  const costSummary = dailyCostUsd === null ? "cost unavailable" : `${formatUsd(dailyCostUsd)} today`;
  const usageSummary = dailyTokens === null ? "token usage unavailable" : `${formatCount(dailyTokens)} tokens today`;
  const level =
    dailyCostUsd !== null &&
    thresholds.anthropicDailyWarnUsd !== null &&
    dailyCostUsd >= thresholds.anthropicDailyWarnUsd
      ? "warn"
      : "ok";

  return {
    provider: "anthropic",
    level,
    summary:
      level === "warn" && thresholds.anthropicDailyWarnUsd !== null
        ? `Anthropic daily cost reached ${costSummary}.`
        : `Anthropic usage looks normal (${costSummary ?? "cost unavailable"}).`,
    usageSummary,
    costSummary,
    details
  };
}

async function fetchAnthropicSnapshot(window: ProviderCheckWindow, thresholds: ThresholdConfig): Promise<ProviderSnapshot> {
  const adminApiKey = process.env.ANTHROPIC_ADMIN_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!adminApiKey) {
    return {
      provider: "anthropic",
      level: "unavailable",
      summary: "Anthropic admin usage API is not configured.",
      usageSummary: null,
      costSummary: null,
      details: ["Set ANTHROPIC_ADMIN_API_KEY to enable official usage/cost monitoring."]
    };
  }

  const headers = {
    "content-type": "application/json",
    "x-api-key": adminApiKey,
    "anthropic-version": "2023-06-01"
  };

  const usageUrl = new URL(ANTHROPIC_USAGE_URL);
  usageUrl.searchParams.set("starting_at", window.dayStartUtc.toISOString());
  usageUrl.searchParams.set("ending_at", window.nextDayUtc.toISOString());
  usageUrl.searchParams.set("granularity", "1d");

  const costUrl = new URL(ANTHROPIC_COST_URL);
  costUrl.searchParams.set("starting_at", window.dayStartUtc.toISOString());
  costUrl.searchParams.set("ending_at", window.nextDayUtc.toISOString());
  costUrl.searchParams.set("granularity", "1d");

  const [{ json: usageJson }, { json: costJson }] = await Promise.all([
    fetchJson({ url: usageUrl.toString(), headers }),
    fetchJson({ url: costUrl.toString(), headers })
  ]);

  const dailyTokens = (() => {
    const total = sumMatchingNumbers(usageJson, /token/i);
    return total > 0 ? total : null;
  })();

  const dailyCostUsd = (() => {
    const total = sumUsdAmounts(costJson);
    return total > 0 ? total : null;
  })();

  const details = [
    `Window: ${window.dayStartUtc.toISOString()} to ${window.nextDayUtc.toISOString()}`,
    dailyTokens !== null ? `Total token volume: ${formatCount(dailyTokens)}` : "Token totals unavailable from current response.",
    dailyCostUsd !== null ? `Daily cost: ${formatUsd(dailyCostUsd)}` : "Cost total unavailable from current response."
  ];

  return buildAnthropicSnapshot({ dailyCostUsd, dailyTokens, details, thresholds });
}

async function resolveExaUsageApiKeyId(serviceKey: string): Promise<{ id: string | null; details: string[] }> {
  const configuredId = process.env.EXA_USAGE_API_KEY_ID?.trim();
  if (configuredId) {
    return { id: configuredId, details: [`Using configured Exa usage key id ${configuredId}.`] };
  }

  const configuredName = process.env.EXA_USAGE_API_KEY_NAME?.trim();
  const { json } = await fetchJson({
    url: `${EXA_ADMIN_API_BASE}/api-keys`,
    headers: {
      "content-type": "application/json",
      "x-api-key": serviceKey
    }
  });

  const keys = Array.isArray((json as { apiKeys?: unknown }).apiKeys)
    ? ((json as { apiKeys: unknown[] }).apiKeys as Array<Record<string, unknown>>)
    : Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data as Array<Record<string, unknown>>)
    : Array.isArray(json)
      ? (json as Array<Record<string, unknown>>)
      : [];

  const normalized = keys
    .map((item) => {
      const id = typeof item.id === "string" ? item.id.trim() : null;
      const name = typeof item.name === "string" ? item.name.trim() : null;
      return { id, name };
    })
    .filter((item): item is { id: string; name: string | null } => Boolean(item.id));

  if (configuredName) {
    const exactMatch = normalized.find((item) => item.name === configuredName);
    if (exactMatch) {
      return {
        id: exactMatch.id,
        details: [`Resolved Exa usage key id from EXA_USAGE_API_KEY_NAME=${configuredName}.`]
      };
    }

    return {
      id: null,
      details: [`No Exa API key matched EXA_USAGE_API_KEY_NAME=${configuredName}.`]
    };
  }

  if (normalized.length === 1) {
    return {
      id: normalized[0].id,
      details: ["Resolved Exa usage key id automatically because exactly one Exa API key was returned."]
    };
  }

  return {
    id: null,
    details:
      normalized.length === 0
        ? ["Exa API key listing returned no key ids."]
        : ["Multiple Exa API keys exist. Set EXA_USAGE_API_KEY_ID or EXA_USAGE_API_KEY_NAME to choose one."]
  };
}

async function fetchExaSnapshot(window: ProviderCheckWindow, thresholds: ThresholdConfig): Promise<ProviderSnapshot> {
  const serviceKey = process.env.EXA_SERVICE_API_KEY?.trim() || process.env.EXA_API_KEY?.trim();

  if (!serviceKey) {
    return {
      provider: "exa",
      level: "unavailable",
      summary: "Exa usage API is not configured.",
      usageSummary: null,
      costSummary: null,
      details: ["Set EXA_SERVICE_API_KEY or EXA_API_KEY to enable Exa usage monitoring."]
    };
  }

  const resolvedKey = await resolveExaUsageApiKeyId(serviceKey);
  if (!resolvedKey.id) {
    return {
      provider: "exa",
      level: "unavailable",
      summary: "Exa usage key id could not be resolved automatically.",
      usageSummary: null,
      costSummary: null,
      details: resolvedKey.details
    };
  }

  const usageUrl = `${EXA_ADMIN_API_BASE}/api-keys/${encodeURIComponent(resolvedKey.id)}/usage`;
  const { json } = await fetchJson({
    url: usageUrl,
    headers: {
      "content-type": "application/json",
      "x-api-key": serviceKey
    }
  });

  const totalRequests = (() => {
    const total = sumMatchingNumbers(json, /(request|count|usage)/i);
    return total > 0 ? total : null;
  })();
  const totalCostUsd = (() => {
    const total = sumUsdAmounts(json);
    return total > 0 ? total : null;
  })();

  const level =
    totalCostUsd !== null && thresholds.exaMonthlyWarnUsd !== null && totalCostUsd >= thresholds.exaMonthlyWarnUsd
      ? "warn"
      : "ok";

  return {
    provider: "exa",
    level,
    summary:
      level === "warn" && thresholds.exaMonthlyWarnUsd !== null
        ? `Exa estimated cost reached ${formatUsd(totalCostUsd)}.`
        : `Exa usage looks normal (${formatUsd(totalCostUsd) ?? "cost unavailable"}).`,
    usageSummary: totalRequests === null ? "request volume unavailable" : `${formatCount(totalRequests)} usage units`,
    costSummary: totalCostUsd === null ? "cost unavailable" : `${formatUsd(totalCostUsd)} total`,
    details: [
      `Window reference date: ${toIsoDate(window.now)}`,
      ...resolvedKey.details,
      totalRequests !== null ? `Usage units counted: ${formatCount(totalRequests)}` : "Usage-unit total unavailable.",
      totalCostUsd !== null ? `Cost total: ${formatUsd(totalCostUsd)}` : "Cost total unavailable."
    ]
  };
}

async function fetchDeepgramSnapshot(window: ProviderCheckWindow, thresholds: ThresholdConfig): Promise<ProviderSnapshot> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  const projectId = process.env.DEEPGRAM_PROJECT_ID?.trim();

  if (!apiKey || !projectId) {
    return {
      provider: "deepgram",
      level: "unavailable",
      summary: "Deepgram management APIs are not fully configured.",
      usageSummary: null,
      costSummary: null,
      details: ["Set DEEPGRAM_API_KEY and DEEPGRAM_PROJECT_ID to enable Deepgram usage/billing monitoring."]
    };
  }

  const headers = {
    "content-type": "application/json",
    Authorization: `Token ${apiKey}`
  };

  const billingUrl = new URL(`${DEEPGRAM_API_BASE}/${encodeURIComponent(projectId)}/billing/breakdown`);
  billingUrl.searchParams.set("start", toIsoDate(window.dayStartUtc));
  billingUrl.searchParams.set("end", toIsoDate(window.nextDayUtc));

  const balanceUrl = `${DEEPGRAM_API_BASE}/${encodeURIComponent(projectId)}/balances`;
  const usageUrl = new URL(`${DEEPGRAM_API_BASE}/${encodeURIComponent(projectId)}/usage`);
  usageUrl.searchParams.set("start", toIsoDate(window.dayStartUtc));
  usageUrl.searchParams.set("end", toIsoDate(window.nextDayUtc));

  const [{ json: billingJson }, { json: balancesJson }, { json: usageJson }] = await Promise.all([
    fetchJson({ url: billingUrl.toString(), headers }),
    fetchJson({ url: balanceUrl, headers }),
    fetchJson({ url: usageUrl.toString(), headers })
  ]);

  const dailyCostUsd = (() => {
    const total = sumUsdAmounts(billingJson);
    return total > 0 ? total : null;
  })();
  const remainingBalanceUsd = (() => {
    const total = sumUsdAmounts(balancesJson);
    return total > 0 ? total : null;
  })();
  const usageUnits = (() => {
    const total = sumMatchingNumbers(usageJson, /(seconds|minutes|duration|requests|count)/i);
    return total > 0 ? total : null;
  })();

  const warnByCost =
    dailyCostUsd !== null && thresholds.deepgramDailyWarnUsd !== null && dailyCostUsd >= thresholds.deepgramDailyWarnUsd;
  const warnByBalance =
    remainingBalanceUsd !== null &&
    thresholds.deepgramBalanceWarnUsd !== null &&
    remainingBalanceUsd <= thresholds.deepgramBalanceWarnUsd;
  const level = warnByCost || warnByBalance ? "warn" : "ok";

  return {
    provider: "deepgram",
    level,
    summary:
      warnByBalance && remainingBalanceUsd !== null
        ? `Deepgram remaining balance is low (${formatUsd(remainingBalanceUsd)}).`
        : warnByCost && dailyCostUsd !== null
          ? `Deepgram daily cost reached ${formatUsd(dailyCostUsd)}.`
          : `Deepgram usage looks normal (${formatUsd(dailyCostUsd) ?? "cost unavailable"} today).`,
    usageSummary: usageUnits === null ? "usage unavailable" : `${formatCount(usageUnits)} daily usage units`,
    costSummary:
      dailyCostUsd === null
        ? "cost unavailable"
        : `${formatUsd(dailyCostUsd)} today${remainingBalanceUsd === null ? "" : `, ${formatUsd(remainingBalanceUsd)} remaining`}`,
    details: [
      `Billing window: ${toIsoDate(window.dayStartUtc)} to ${toIsoDate(window.nextDayUtc)}`,
      usageUnits !== null ? `Usage units: ${formatCount(usageUnits)}` : "Usage units unavailable.",
      dailyCostUsd !== null ? `Daily cost: ${formatUsd(dailyCostUsd)}` : "Daily cost unavailable.",
      remainingBalanceUsd !== null ? `Remaining balance: ${formatUsd(remainingBalanceUsd)}` : "Remaining balance unavailable."
    ]
  };
}

async function fetchResendSnapshot(thresholds: ThresholdConfig): Promise<ProviderSnapshot> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      provider: "resend",
      level: "unavailable",
      summary: "Resend API key is not configured.",
      usageSummary: null,
      costSummary: null,
      details: ["Set RESEND_API_KEY to enable Resend quota monitoring."]
    };
  }

  const response = await fetch(`${RESEND_API_BASE}/domains`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    cache: "no-store"
  });

  const json = await parseJson(response);
  if (!response.ok) {
    throw new Error(`RESEND_HTTP_${response.status}`);
  }

  const dailyQuotaUsed = parseNumber(response.headers.get("x-resend-daily-quota"));
  const monthlyQuotaUsed = parseNumber(response.headers.get("x-resend-monthly-quota"));
  const rateLimitRemaining = parseNumber(response.headers.get("ratelimit-remaining"));
  const rateLimitLimit = parseNumber(response.headers.get("ratelimit-limit"));

  const dailyRatio =
    dailyQuotaUsed !== null && thresholds.resendDailyQuotaLimit !== null && thresholds.resendDailyQuotaLimit > 0
      ? dailyQuotaUsed / thresholds.resendDailyQuotaLimit
      : null;
  const monthlyRatio =
    monthlyQuotaUsed !== null && thresholds.resendMonthlyQuotaLimit !== null && thresholds.resendMonthlyQuotaLimit > 0
      ? monthlyQuotaUsed / thresholds.resendMonthlyQuotaLimit
      : null;
  const warn =
    (dailyRatio !== null && dailyRatio >= thresholds.resendQuotaWarnRatio) ||
    (monthlyRatio !== null && monthlyRatio >= thresholds.resendQuotaWarnRatio);

  return {
    provider: "resend",
    level: warn ? "warn" : "ok",
    summary: warn
      ? "Resend quota usage is approaching the configured plan limit."
      : "Resend quota usage looks normal.",
    usageSummary:
      dailyQuotaUsed === null && monthlyQuotaUsed === null
        ? "quota headers unavailable"
        : [
            dailyQuotaUsed === null ? null : `${formatCount(dailyQuotaUsed)} daily sends used`,
            monthlyQuotaUsed === null ? null : `${formatCount(monthlyQuotaUsed)} monthly sends used`
          ]
            .filter(Boolean)
            .join(", "),
    costSummary: "billing endpoint unavailable; monitoring via official quota headers",
    details: [
      Array.isArray((json as { data?: unknown }).data) ? "Quota probe via GET /domains succeeded." : "Quota probe succeeded.",
      dailyQuotaUsed === null ? "Daily quota header unavailable." : `Daily quota used: ${formatCount(dailyQuotaUsed)}`,
      monthlyQuotaUsed === null ? "Monthly quota header unavailable." : `Monthly quota used: ${formatCount(monthlyQuotaUsed)}`,
      rateLimitRemaining === null || rateLimitLimit === null
        ? "Rate-limit headers unavailable."
        : `Rate-limit remaining: ${formatCount(rateLimitRemaining)} / ${formatCount(rateLimitLimit)}`
    ]
  };
}

function buildPerplexitySnapshot(): ProviderSnapshot {
  return {
    provider: "perplexity",
    level: "unavailable",
    summary: "Perplexity billing is not polled automatically.",
    usageSummary: null,
    costSummary: null,
    details: ["No official billing endpoint is wired in; operational issues still surface through error alerts."]
  };
}

export async function collectProviderSnapshots(now = new Date()): Promise<ProviderSnapshot[]> {
  const window = getWindow(now);
  const thresholds = getThresholdConfig();

  const results = await Promise.allSettled([
    fetchAnthropicSnapshot(window, thresholds),
    fetchExaSnapshot(window, thresholds),
    fetchDeepgramSnapshot(window, thresholds),
    fetchResendSnapshot(thresholds),
    Promise.resolve(buildPerplexitySnapshot())
  ]);

  return results.map((result, index) => {
    const provider = ["anthropic", "exa", "deepgram", "resend", "perplexity"][index] as ProviderSnapshot["provider"];
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider,
      level: "error",
      summary: `${provider} monitoring failed.`,
      usageSummary: null,
      costSummary: null,
      details: [result.reason instanceof Error ? result.reason.message : "Unknown monitoring error."]
    } satisfies ProviderSnapshot;
  });
}

export function buildDailyDigestContent(args: { runAt: Date; snapshots: ProviderSnapshot[] }): {
  subject: string;
  text: string;
  html: string;
} {
  const dateLabel = args.runAt.toISOString().slice(0, 10);
  const statusSummary = args.snapshots
    .map((snapshot) => `${snapshot.provider}: ${snapshot.level}`)
    .join(" | ");

  const textLines = [
    `No Circles admin monitor for ${dateLabel}`,
    "",
    `Status summary: ${statusSummary}`,
    ""
  ];

  for (const snapshot of args.snapshots) {
    textLines.push(`${snapshot.provider.toUpperCase()} [${snapshot.level.toUpperCase()}]`);
    textLines.push(snapshot.summary);
    if (snapshot.usageSummary) {
      textLines.push(`Usage: ${snapshot.usageSummary}`);
    }
    if (snapshot.costSummary) {
      textLines.push(`Cost: ${snapshot.costSummary}`);
    }
    for (const detail of snapshot.details) {
      textLines.push(`- ${detail}`);
    }
    textLines.push("");
  }

  const htmlSections = args.snapshots
    .map((snapshot) => {
      const details = snapshot.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("");
      return [
        `<section style="margin:0 0 24px 0;">`,
        `<h2 style="font-size:16px;margin:0 0 8px 0;">${escapeHtml(snapshot.provider.toUpperCase())} <span style="font-weight:400;">[${escapeHtml(snapshot.level.toUpperCase())}]</span></h2>`,
        `<p style="margin:0 0 8px 0;">${escapeHtml(snapshot.summary)}</p>`,
        snapshot.usageSummary ? `<p style="margin:0 0 4px 0;"><strong>Usage:</strong> ${escapeHtml(snapshot.usageSummary)}</p>` : "",
        snapshot.costSummary ? `<p style="margin:0 0 8px 0;"><strong>Cost:</strong> ${escapeHtml(snapshot.costSummary)}</p>` : "",
        details ? `<ul style="margin:0;padding-left:20px;">${details}</ul>` : "",
        `</section>`
      ].join("");
    })
    .join("");

  return {
    subject: `[No Circles][Admin] Daily monitor ${dateLabel}`,
    text: textLines.join("\n").trim(),
    html: [
      `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">`,
      `<h1 style="font-size:18px;margin:0 0 8px 0;">No Circles admin monitor for ${escapeHtml(dateLabel)}</h1>`,
      `<p style="margin:0 0 16px 0;"><strong>Status summary:</strong> ${escapeHtml(statusSummary)}</p>`,
      htmlSections,
      `</div>`
    ].join("")
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
