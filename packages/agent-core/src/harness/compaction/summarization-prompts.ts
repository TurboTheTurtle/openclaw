import type { Model } from "@openclaw/llm-core";
import type { ThinkingLevel } from "../../types.js";
import { buildSummaryCheckpointPrompt } from "./summary-checkpoint-prompt.js";

/** Invariant shared by ordinary and branch compaction requests. */
const SENDER_PROVENANCE_SUMMARIZATION_INSTRUCTIONS =
  "When a conversation line includes sender={...}, that JSON identifies the author of that user turn. The id is authoritative; name and username are readable labels only. Preserve attribution for material facts, preferences, instructions, decisions, and disagreements; never transfer them to another sender or an anonymous user. A user line without sender={...} is unattributed: preserve its facts as unattributed and do not assign them to a known sender.";

/** Shared role instruction used by ordinary and branch compaction requests. */
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.

${SENDER_PROVENANCE_SUMMARIZATION_INSTRUCTIONS}

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const SUMMARIZATION_PROMPT = buildSummaryCheckpointPrompt({
  introduction:
    "The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.",
  goal: "[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]",
  constraints:
    '- [Any constraints, preferences, or requirements mentioned by user]\n- [Or "(none)" if none were mentioned]',
  inProgress: "- [ ] [Current work]",
  blocked: "- [Issues preventing progress, if any]",
  decisions: "- **[Decision]**: [Brief rationale]",
  nextSteps: "1. [Ordered list of what should happen next]",
  criticalContext:
    '- [Any data, examples, or references needed to continue]\n- [Or "(none)" if not applicable]',
});

const UPDATE_SUMMARIZATION_PROMPT = buildSummaryCheckpointPrompt({
  introduction: `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed. Record checks that ran and their results as completed, even when they failed; keep unresolved blockers separate.
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it`,
  goal: "[Preserve existing goals, add new ones if the task expanded]",
  constraints: "- [Preserve existing, add new ones discovered]",
  done: "- [x] [Include previously done items AND newly completed items]",
  inProgress: "- [ ] [Current work - update based on progress]",
  blocked: "- [Current blockers - remove if resolved]",
  decisions: "- **[Decision]**: [Brief rationale] (preserve all previous, add new)",
  nextSteps: "1. [Update based on current state]",
  criticalContext: "- [Preserve important context, add new if needed]",
});

/** Caller-owned formats replace the default headings; focus remains additive. */
export type CompactionSummaryPrompt =
  | { kind: "turn-prefix" }
  | { kind: "custom"; instructions: string };

export type SummaryRequestParams = {
  model: Model;
  reserveTokens: number;
  summaryPrompt?: CompactionSummaryPrompt;
  customInstructions?: string;
  previousSummary?: string;
  thinkingLevel?: ThinkingLevel;
};

export function prepareSummaryRequest(params: SummaryRequestParams) {
  const { model, reserveTokens, summaryPrompt, previousSummary } = params;
  const maxTokens = Math.min(
    Math.floor((summaryPrompt?.kind === "turn-prefix" ? 0.5 : 0.8) * reserveTokens),
    model.maxTokens > 0 ? model.maxTokens : Number.POSITIVE_INFINITY,
  );
  const selectedPrompt =
    summaryPrompt?.kind === "turn-prefix"
      ? TURN_PREFIX_SUMMARIZATION_PROMPT
      : summaryPrompt?.instructions;
  const promptWithoutProvenance = summaryPrompt
    ? [
        previousSummary &&
          "Update the previous summary with the new conversation. Preserve relevant facts, decisions, and unresolved asks; remove stale or duplicate detail. Use the format below.",
        selectedPrompt,
      ]
        .filter(Boolean)
        .join("\n\n")
    : previousSummary
      ? UPDATE_SUMMARIZATION_PROMPT
      : SUMMARIZATION_PROMPT;
  return { maxTokens, prompt: promptWithoutProvenance };
}

const TURN_PREFIX_SUMMARIZATION_PROMPT = `This is the PREFIX of a turn that was too large to keep. The SUFFIX (recent work) is retained.

Summarize the prefix to provide context for the retained suffix:

## Original Request
[What did the user ask for in this turn?]

## Early Progress
- [Key decisions and work done in the prefix]

## Context for Suffix
- [Information needed to understand the retained recent work]

Be concise. Focus on what's needed to understand the kept suffix.`;

export function createSummarizationContext(promptText: string) {
  return {
    systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: promptText }],
        timestamp: Date.now(),
      },
    ],
  };
}
