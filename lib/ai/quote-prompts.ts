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
  "You are a personalized quote curator for a daily newsletter. You match one quote to the reader profile with high relevance and specificity.";

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
    "Selection objective:",
    "- fit the reader profile and most recent feedback",
    "- prefer concrete, grounded, non-generic language",
    "- avoid hype, cliche, and motivational fluff",
    "- avoid quotes that conflict with recent feedback",
    "",
    "Output strict JSON only with exactly this shape:",
    '{"selected_index": <1-based integer>}',
    "",
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
