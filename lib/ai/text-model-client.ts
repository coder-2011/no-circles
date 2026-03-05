const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_MESSAGES_API_URL = "https://openrouter.ai/api/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const APP_TITLE = "No Circles";

type CallTextModelArgs = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  fallbackModel?: string;
  maxTokens: number;
  temperature: number;
  missingApiKeyError: string;
  invalidResponseError: string;
  emptyResponseError: string;
  httpErrorPrefix: string;
  authErrorCode?: string;
};

type ProviderConfig =
  | {
      kind: "openrouter";
      url: string;
      headers: Record<string, string>;
    }
  | {
      kind: "anthropic";
      url: string;
      headers: Record<string, string>;
    };

type ProviderSet = {
  primary: ProviderConfig;
  fallback: ProviderConfig | null;
};

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function buildAnthropicProvider(): ProviderConfig | null {
  const anthropicApiKey = trimEnv("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    return null;
  }

  return {
    kind: "anthropic",
    url: ANTHROPIC_MESSAGES_API_URL,
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION
    }
  };
}

function buildProviderSet(missingApiKeyError: string): ProviderSet {
  const openRouterApiKey = trimEnv("OPENROUTER_API_KEY");
  if (openRouterApiKey) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      Authorization: `Bearer ${openRouterApiKey}`,
      "anthropic-version": ANTHROPIC_VERSION
    };

    const siteUrl = trimEnv("NEXT_PUBLIC_SITE_URL");
    if (siteUrl) {
      const normalizedSiteUrl = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl.replace(/^\/+/, "")}`;
      headers["HTTP-Referer"] = normalizedSiteUrl;
    }
    headers["X-Title"] = APP_TITLE;

    return {
      primary: {
        kind: "openrouter",
        url: OPENROUTER_MESSAGES_API_URL,
        headers
      },
      fallback: buildAnthropicProvider()
    };
  }

  const anthropic = buildAnthropicProvider();
  if (anthropic) {
    return {
      primary: anthropic,
      fallback: null
    };
  }

  throw new Error(missingApiKeyError);
}

async function postToProvider(provider: ProviderConfig, args: CallTextModelArgs, modelOverride?: string): Promise<Response> {
  return fetch(provider.url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
      model: modelOverride ?? args.model,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      system: args.systemPrompt,
      messages: [{ role: "user", content: args.userPrompt }]
    })
  });
}

export function readFirstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = trimEnv(name);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function requireFirstEnv(names: string[], missingError: string): string {
  const value = readFirstEnv(names);
  if (!value) {
    throw new Error(missingError);
  }

  return value;
}

export function extractTextContent(value: unknown, invalidResponseError: string, emptyResponseError: string): string {
  if (!value || typeof value !== "object") {
    throw new Error(invalidResponseError);
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error(invalidResponseError);
  }

  const text = content
    .filter((chunk): chunk is { type: string; text: string } => {
      if (!chunk || typeof chunk !== "object") {
        return false;
      }

      const candidate = chunk as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string";
    })
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(emptyResponseError);
  }

  return text;
}

export async function callAnthropicCompatibleTextModel(args: CallTextModelArgs): Promise<string> {
  const providers = buildProviderSet(args.missingApiKeyError);
  let response = await postToProvider(providers.primary, args);

  if (
    !response.ok &&
    (response.status === 401 || response.status === 403) &&
    providers.primary.kind === "openrouter" &&
    providers.fallback
  ) {
    response = await postToProvider(providers.fallback, args, args.fallbackModel);
  }

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && args.authErrorCode) {
      throw new Error(args.authErrorCode);
    }

    throw new Error(`${args.httpErrorPrefix}${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json) {
    throw new Error(args.invalidResponseError);
  }

  return extractTextContent(json, args.invalidResponseError, args.emptyResponseError);
}
