import {
  callAnthropicCompatibleTextModel,
  readFirstEnv,
  requireFirstEnv
} from "@/lib/ai/text-model-client";

export type GenerateMemoryArgs = {
  systemPrompt: string;
  userPrompt: string;
};

export const ANTHROPIC_AUTH_ERROR = "ANTHROPIC_AUTH_FAILED";

export async function callMemoryModel(args: GenerateMemoryArgs): Promise<string> {
  const modelName = requireFirstEnv(
    ["OPENROUTER_MEMORY_MODEL", "ANTHROPIC_MEMORY_MODEL"],
    "MISSING_ANTHROPIC_MEMORY_MODEL"
  );
  const fallbackModel = readFirstEnv(["ANTHROPIC_MEMORY_MODEL"]);

  return callAnthropicCompatibleTextModel({
    model: modelName,
    fallbackModel,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    maxTokens: 1200,
    temperature: 0,
    missingApiKeyError: "MISSING_ANTHROPIC_API_KEY",
    invalidResponseError: "INVALID_MODEL_RESPONSE",
    emptyResponseError: "EMPTY_MODEL_RESPONSE",
    httpErrorPrefix: "ANTHROPIC_HTTP_",
    authErrorCode: ANTHROPIC_AUTH_ERROR
  });
}
