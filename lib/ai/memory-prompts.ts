import { MEMORY_WORD_CAP } from "@/lib/memory/contract";

export function buildOnboardingMemoryPrompt(brainDumpText: string): string {
  return [
    "You format user interests into canonical memory text.",
    "Return exactly these sections: PERSONALITY, ACTIVE_INTERESTS, SUPPRESSED_INTERESTS, RECENT_FEEDBACK.",
    `Output must be plain text and under ${MEMORY_WORD_CAP} words.`,
    "Use concise bullet points in each section.",
    "If no suppression exists, write '-' under SUPPRESSED_INTERESTS.",
    "Input:",
    brainDumpText
  ].join("\n\n");
}

export function buildReplyMemoryPrompt(currentMemory: string, inboundReplyText: string): string {
  return [
    "You update canonical user memory from a new email reply.",
    "Keep prior relevant context unless explicitly changed by user.",
    "Return exactly these sections: PERSONALITY, ACTIVE_INTERESTS, SUPPRESSED_INTERESTS, RECENT_FEEDBACK.",
    `Output must be plain text and under ${MEMORY_WORD_CAP} words.`,
    "Current memory:",
    currentMemory,
    "Inbound reply:",
    inboundReplyText
  ].join("\n\n");
}
