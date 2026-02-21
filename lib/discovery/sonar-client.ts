import type { ExaSearchFn, ExaSearchResult } from "@/lib/discovery/types";
import { createHash, randomBytes } from "node:crypto";

const PERPLEXITY_CHAT_COMPLETIONS_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_SONAR_MODEL = "sonar";
const MAX_SONAR_RESULTS = 10;
const CREATIVE_LENSE_POOL = [
  "counterfactual failure modes",
  "unexpected tradeoff reversals",
  "rare edge-case postmortems",
  "cross-domain analogy with operational evidence",
  "non-obvious implementation constraints",
  "high-leverage architecture inflection points",
  "benchmark disagreement analysis",
  "production incident lessons with concrete remediation"
] as const;
const KEYWORD_STYLE_POOL = [
  "short, dense noun phrases",
  "named methods/protocols/standards",
  "failure and recovery vocabulary",
  "evaluation and benchmarking terms",
  "migration and rollout terminology",
  "systems-performance terminology",
  "operator-style filters and qualifiers",
  "specific artifact-type markers"
] as const;
const QUERY_OPERATOR_POOL = [
  "postmortem",
  "\"case study\"",
  "\"failure mode\"",
  "\"trade-off\"",
  "\"lessons learned\"",
  "\"production\"",
  "benchmark",
  "incident",
  "migration",
  "\"design doc\""
] as const;

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sampleWithoutReplacement<T>(values: readonly T[], count: number): T[] {
  const pool = [...values];
  const picked: T[] = [];
  const target = Math.max(0, Math.min(count, pool.length));

  for (let index = 0; index < target; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(randomIndex, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
}

function stripFence(text: string): string {
  const fencedMatch = text.trim().match(/```(?:text|txt|md|markdown)?\s*([\s\S]*?)\s*```/i);
  return (fencedMatch?.[1] ?? text).trim();
}

function extractTextContent(json: unknown): string {
  if (!json || typeof json !== "object") {
    throw new Error("SONAR_INVALID_RESPONSE");
  }

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("SONAR_INVALID_RESPONSE");
  }

  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("SONAR_EMPTY_RESPONSE");
  }

  return content;
}

function parseSonarLine(line: string): ExaSearchResult | null {
  const normalized = normalizeLine(line);
  if (!normalized) return null;

  const match = normalized.match(/^\[(.+?)\]\s*\|\|\s*(https?:\/\/\S+)$/i);
  if (!match) return null;

  const title = normalizeLine(match[1] ?? "");
  const url = (match[2] ?? "").trim().replace(/[),.;]+$/, "");
  if (!title || !url) return null;

  return {
    title,
    url,
    highlights: [title]
  };
}

function parseSonarResults(text: string, limit: number): ExaSearchResult[] {
  const results: ExaSearchResult[] = [];
  const seen = new Set<string>();
  const lines = stripFence(text).split("\n");

  for (const line of lines) {
    if (results.length >= limit) break;
    const parsed = parseSonarLine(line);
    if (!parsed) continue;
    if (seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    results.push(parsed);
  }

  return results;
}

function buildSystemPrompt(numResults: number): string {
  const thematicSeed = Math.floor(Math.random() * 1000000).toString();
  const runEntropyToken = randomBytes(48).toString("hex");
  const themedEntropyToken = createHash("sha256").update(`${thematicSeed}:${runEntropyToken}`).digest("hex");
  const runLensList = sampleWithoutReplacement(CREATIVE_LENSE_POOL, 4).map((value) => `- ${value}`).join("\n");
  const runStyleList = sampleWithoutReplacement(KEYWORD_STYLE_POOL, 3).map((value) => `- ${value}`).join("\n");
  const runOperatorList = sampleWithoutReplacement(QUERY_OPERATOR_POOL, 3).map((value) => `- ${value}`).join("\n");

  return [
    "Retrieve high-signal links for one active-interest topic query.",
    "Be very creative and surprising, but stay inside the topic field.",
    "Prefer evidence-heavy, practical, non-obvious sources (postmortems, benchmarks, migrations, incidents, design docs).",
    "Topic-memory intent contract:",
    "- Treat the user input topic as ACTIVE_INTERESTS context.",
    "- Prioritize high-signal coverage within the topic without collapsing into one repeated sub-angle.",
    "- Prefer diverse sub-angles inside the topic (implementation, evidence, constraints, failure modes, trade-offs).",
    "- Avoid dopamine-bait framing and repetitive hype loops.",
    "- If user input contains soft-downweight intent wording, keep relevance but reduce hype/volume bias.",
    "- If user input contains hard-stop intent wording, return conservative results and avoid broad speculative expansion.",
    "Rules:",
    `- Return exactly ${numResults} lines when possible.`,
    "- One candidate per line.",
    "- Use run entropy token, themed token, and directives as hidden variation guidance; never print tokens.",
    "- Use thematic seed as hidden guidance for tone/rhythm only; never print the seed.",
    "- Output format per line must be exactly: [TITLE] || https://full-url",
    "- Output only lines in this format. No JSON, bullets, numbering, commentary, or extra text.",
    "- URLs must be direct article/page links.",
    "",
    `Run entropy token: ${runEntropyToken}`,
    `Themed entropy token: ${themedEntropyToken}`,
    `Thematic seed: ${thematicSeed}`,
    "Creativity lenses for this run (use at least two):",
    runLensList,
    "",
    "Keyword style directives for this run:",
    runStyleList,
    "",
    "High-signal operator hints to bias retrieval choices:",
    runOperatorList
  ].join("\n");
}

export const searchSonar: ExaSearchFn = async ({ query, numResults }) => {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  const modelName = process.env.PERPLEXITY_SONAR_MODEL?.trim() || DEFAULT_SONAR_MODEL;
  if (!apiKey) {
    throw new Error("MISSING_PERPLEXITY_API_KEY");
  }

  const requestedResults = Math.max(1, Math.min(MAX_SONAR_RESULTS, Math.floor(numResults)));
  const response = await fetch(PERPLEXITY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 1.3,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(requestedResults)
        },
        {
          role: "user",
          content: ["ACTIVE_INTEREST_TOPIC:", query].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`SONAR_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  const text = extractTextContent(json);
  return parseSonarResults(text, requestedResults);
};
