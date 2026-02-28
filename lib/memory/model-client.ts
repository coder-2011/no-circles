export type GenerateMemoryArgs = {
  systemPrompt: string;
  userPrompt: string;
};

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";

export const ANTHROPIC_AUTH_ERROR = "ANTHROPIC_AUTH_FAILED";

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_MODEL_RESPONSE");
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
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  return text;
}

export async function callMemoryModel(args: GenerateMemoryArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName = process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }
  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_MEMORY_MODEL");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 1200,
      temperature: 0,
      system: args.systemPrompt,
      messages: [{ role: "user", content: args.userPrompt }]
    })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(ANTHROPIC_AUTH_ERROR);
    }

    throw new Error(`ANTHROPIC_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  return extractTextContent(json);
}
