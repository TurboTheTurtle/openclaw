import { adjustMaxTokensForThinking } from "@openclaw/ai/internal/shared";
import {
  resolveClaudeFable5ModelIdentity,
  supportsClaudeAdaptiveThinking,
  type Model,
  type SimpleStreamOptions,
  type StreamFn,
} from "@openclaw/llm-core";
import {
  CHARS_PER_TOKEN_ESTIMATE,
  estimateStringChars,
} from "@openclaw/normalization-core/cjk-chars";
import { resolveAgentReasoningOption } from "../../reasoning.js";
import {
  type AgentCoreCompletionRuntimeDeps,
  consumeAgentCoreStream,
  resolveAgentCoreCompleteFn,
} from "../../runtime-deps.js";
import type { AgentMessage, ThinkingLevel } from "../../types.js";
import { convertToLlm } from "../messages.js";
import {
  CompactionError,
  err,
  InvalidSummaryOutputError,
  ok,
  SummaryOutputBudgetError,
  SummaryProviderError,
  type Result,
} from "../types.js";
import {
  createSummarizationContext,
  prepareSummaryRequest,
  type SummaryRequestParams,
} from "./summarization-prompts.js";
import { extractSummaryText, serializeConversation } from "./utils.js";

export interface SummarizationCompletionParams {
  messages: AgentMessage[];
  prompt: string;
  customInstructions?: string;
  previousSummary?: string;
  model: Model;
  maxTokens: number;
  apiKey: string | undefined;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  thinkingLevel?: ThinkingLevel;
  streamFn?: StreamFn;
  runtime?: AgentCoreCompletionRuntimeDeps;
  errorLabel: string;
}

function prepareSummarizationCompletion(
  params: Omit<SummarizationCompletionParams, "streamFn" | "runtime" | "errorLabel">,
) {
  const conversationText = serializeConversation(convertToLlm(params.messages));
  let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
  if (params.previousSummary) {
    promptText += `<previous-summary>\n${params.previousSummary}\n</previous-summary>\n\n`;
  }
  promptText += params.prompt;
  // SDK callers also pass generated policy here; the host bounds raw operator focus.
  if (params.customInstructions) {
    promptText += `\n\nAdditional focus: ${params.customInstructions}`;
  }
  const context = createSummarizationContext(promptText);
  const { model, thinkingLevel, maxTokens, signal, apiKey, headers } = params;
  const options: SimpleStreamOptions = { maxTokens, signal, apiKey, headers };
  const fableReasoning =
    (model.api === "anthropic-messages" || model.api === "bedrock-converse-stream") &&
    resolveClaudeFable5ModelIdentity(model) !== undefined;
  if ((model.reasoning || fableReasoning) && thinkingLevel) {
    options.reasoning = resolveAgentReasoningOption(model, thinkingLevel);
  }
  return { context, options };
}

/** The completion owner supplies prompt overhead and its full output allowance. */
export function getSummaryRequestBudget(params: SummaryRequestParams): {
  overheadTokens: number;
  outputTokens: number;
} {
  const request = { ...params, ...prepareSummaryRequest(params) };
  const { context, options } = prepareSummarizationCompletion({
    ...request,
    messages: [],
    apiKey: undefined,
  });
  const inputChars =
    estimateStringChars(context.systemPrompt) +
    context.messages.reduce(
      (sum, message) =>
        sum +
        message.content.reduce(
          (contentSum, block) => contentSum + estimateStringChars(block.text),
          0,
        ),
      0,
    );
  const reasoning = options.reasoning;
  const expandsThinking =
    (params.model.api === "anthropic-messages" ||
      params.model.api === "openclaw-anthropic-messages-transport" ||
      params.model.api === "bedrock-converse-stream") &&
    !supportsClaudeAdaptiveThinking(params.model);
  // An injected stream can hide the transport. Keep the larger manual-thinking
  // allowance, including max effort and the sub-minimum thinking fallback.
  const outputTokens =
    expandsThinking && reasoning && reasoning !== "off"
      ? Math.max(
          request.maxTokens,
          adjustMaxTokensForThinking(request.maxTokens, params.model.maxTokens, reasoning)
            .maxTokens,
        )
      : request.maxTokens;
  return { overheadTokens: Math.ceil(inputChars / CHARS_PER_TOKEN_ESTIMATE), outputTokens };
}

/** Runs one summarization completion and maps abort/error stops to CompactionError. */
export async function runSummarizationCompletion(
  params: SummarizationCompletionParams,
): Promise<Result<string, CompactionError>> {
  const { context, options } = prepareSummarizationCompletion(params);
  const response = params.streamFn
    ? await consumeAgentCoreStream(params.streamFn(params.model, context, options), params.runtime)
    : await resolveAgentCoreCompleteFn(params.runtime)(params.model, context, options);
  // Usage belongs to the completed provider request even when its summary is invalid.
  params.runtime?.internalUsageSink?.(response.usage);
  if (response.stopReason === "aborted") {
    return err(
      new CompactionError("aborted", response.errorMessage || `${params.errorLabel} aborted`),
    );
  }
  if (response.stopReason === "error") {
    return err(
      new SummaryProviderError(
        `${params.errorLabel} failed: ${response.errorMessage || "Unknown error"}`,
        response,
      ),
    );
  }

  const summary = extractSummaryText(response);
  if (summary === undefined) {
    if (response.stopReason === "length") {
      return err(
        new SummaryOutputBudgetError(
          `${params.errorLabel} failed: summary output budget (${params.maxTokens} tokens) was exhausted without visible text; reduce thinking or increase the selected model's maxTokens before retrying`,
        ),
      );
    }
    return err(
      new InvalidSummaryOutputError(`${params.errorLabel} failed: model returned no summary text`),
    );
  }
  return ok(summary);
}
