export type QuotePromptCandidate = {
  index: number;
  text: string;
  author: string;
  category: string | null;
};

type BuildQuoteSelectionUserPromptArgs = {
  personalitySection: string;
  recentFeedbackSection: string;
  candidates: QuotePromptCandidate[];
};

export const QUOTE_SELECTION_SYSTEM_PROMPT =
  "You are a seasoned literary editor curating the closing quote for a personalized daily newsletter. You match one quote to the reader profile with high relevance, specificity, and tonal fit while avoiding generic inspiration.";

export function buildQuoteSelectionUserPrompt(args: BuildQuoteSelectionUserPromptArgs): string {
  const candidates = args.candidates
    .map((candidate) => {
      const category = candidate.category?.trim() ? candidate.category.trim() : "-";
      return [
        `${candidate.index}.`,
        `QUOTE: ${candidate.text}`,
        `AUTHOR: ${candidate.author}`,
        `CATEGORY: ${category}`
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Task: choose exactly one quote from the candidate list.",
    "SELECTION OBJECTIVE:",
    "- choose quotes that align with and improve upon the reader's PERSONALITY traits",
    "- from RECENT_FEEDBACK, treat '+ [more_like_this] <title>' and '- [less_like_this] <title>' as slight steering signals based on clicked article titles",
    "- these feedback lines are literal item titles, not broad interests, normalized topics, or durable user preferences",
    "- use them only to infer nearby tone, subject matter, or framing that the reader wanted more or less of",
    "- prefer concrete, grounded language",
    "- avoid hype, cliche, and fluff",
    "- avoid quotes that are too conflicting with recent feedback",
    "Output strict JSON only with exactly this shape:",
    "Prefer well known quotationists when possible, but prioritize quote quality and profile fit over fame.",
    '{"selected_index": <1-based integer>}',
    "Reader profile (PERSONALITY):",
    args.personalitySection,
    "",
    "Most recent steering (RECENT_FEEDBACK):",
    args.recentFeedbackSection,
    "",
    "Candidates:",
    candidates
  ].join("\n");
}
