import type { CompactionSummaryPrompt, StreamFn } from "openclaw/plugin-sdk/agent-core";
import { createAssistantMessageEventStream, type Model } from "openclaw/plugin-sdk/llm";
import { describe, expect, it } from "vitest";
import { summarizeInStages } from "./compaction.js";
import { makeAgentAssistantMessage } from "./test-helpers/agent-message-fixtures.js";

const model: Model = {
  id: "summary-model",
  name: "Summary Model",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://example.test",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 2_000,
  maxTokens: 1_000,
};

describe("compaction summary format propagation", () => {
  it.each<{
    name: string;
    overrides: Partial<Parameters<typeof summarizeInStages>[0]>;
    expectedRequests: number;
    overflow?: boolean;
  }>([
    { name: "fitting history", overrides: {}, expectedRequests: 1 },
    { name: "model output cap", overrides: { reserveTokens: 100_000 }, expectedRequests: 1 },
    {
      name: "previous summary budget",
      overrides: { previousSummary: `ORCHID-7319; November 23. ${"prior fact ".repeat(8_000)}` },
      expectedRequests: 3,
    },
    {
      name: "instruction budget",
      overrides: {
        customInstructions: `Retain the recovery code and delivery date. ${"focus ".repeat(15_000)}`,
      },
      expectedRequests: 3,
    },
    {
      name: "summary format budget",
      overrides: {
        summaryPrompt: {
          kind: "custom",
          instructions: `Use ## Decisions. ${"format ".repeat(13_000)}`,
        },
      },
      expectedRequests: 3,
    },
    {
      name: "output reserve",
      overrides: {
        model: { ...model, contextWindow: 32_768, maxTokens: 30_000 },
        reserveTokens: 30_000,
      },
      expectedRequests: 3,
    },
    {
      name: "manual thinking output allowance",
      overrides: {
        model: {
          ...model,
          id: "claude-sonnet-4-20250514",
          api: "anthropic-messages",
          provider: "anthropic",
          reasoning: true,
          contextWindow: 24_000,
          maxTokens: 24_000,
        },
        contextWindow: 24_000,
        thinkingLevel: "high",
      },
      expectedRequests: 3,
    },
    { name: "provider overflow recovery", overrides: {}, expectedRequests: 4, overflow: true },
  ])(
    "uses the complete request budget for $name",
    async ({ overrides, expectedRequests, overflow }) => {
      const requests: string[] = [];
      const streamFn: StreamFn = (_model, context) => {
        requests.push(JSON.stringify(context));
        if (overflow && requests.length === 1) {
          throw new Error("context length exceeded");
        }
        const stream = createAssistantMessageEventStream();
        stream.push({
          type: "done",
          reason: "stop",
          message: makeAgentAssistantMessage({ content: [{ type: "text", text: "summary" }] }),
        });
        stream.end();
        return stream;
      };

      await summarizeInStages({
        messages: Array.from({ length: 6 }, (_, index) => ({
          role: "user" as const,
          content: `receipt_${index}: ${"Preserve the museum inventory. ".repeat(260)}`,
          timestamp: index + 1,
        })),
        model: { ...model, contextWindow: 32_768, maxTokens: 2_048 },
        apiKey: "test-key",
        signal: new AbortController().signal,
        reserveTokens: 2_048,
        maxChunkTokens: 9_011,
        contextWindow: 32_768,
        summaryPrompt: { kind: "custom", instructions: "Use ## Decisions." },
        previousSummary: "Recovery code ORCHID-7319; delivery November 23.",
        customInstructions: "Retain the recovery code and delivery date.",
        streamFn,
        ...overrides,
      });

      expect(requests).toHaveLength(expectedRequests);
      const historyRequest = expectedRequests === 1 ? requests[0] : requests.join("\n");
      for (let index = 0; index < 6; index++) {
        expect(historyRequest).toContain(`receipt_${index}`);
      }
      expect(requests.at(-1)).toContain("ORCHID-7319");
      expect(requests.at(-1)).toContain("November 23");
      expect(requests.at(-1)).toContain("Use ## Decisions.");
      expect(requests.at(-1)).toContain("Retain the recovery code and delivery date.");
    },
  );

  it("does not repeat an unchanged request after a reasoning-only length stop", async () => {
    const requests: Array<{ modelId: string; maxTokens: number | undefined }> = [];
    const streamFn: StreamFn = (selectedModel, _context, options) => {
      requests.push({ modelId: selectedModel.id, maxTokens: options?.maxTokens });
      const stream = createAssistantMessageEventStream();
      stream.push({
        type: "done",
        reason: "length",
        message: makeAgentAssistantMessage({
          content: [{ type: "thinking", thinking: "reasoning filled the output budget" }],
          stopReason: "length",
        }),
      });
      stream.end();
      return stream;
    };

    await expect(
      summarizeInStages({
        messages: [{ role: "user", content: "Preserve the deployment decision.", timestamp: 1 }],
        model: { ...model, reasoning: true },
        apiKey: "test-key", // pragma: allowlist secret
        signal: new AbortController().signal,
        reserveTokens: 1_000,
        maxChunkTokens: 1_000,
        contextWindow: 2_000,
        streamFn,
      }),
    ).rejects.toThrow("summary output budget (800 tokens) was exhausted");
    expect(requests).toEqual([{ modelId: model.id, maxTokens: 800 }]);
  });

  it.each([
    {
      kind: "custom",
      instructions: "Use exactly these headings:\n## Decisions\n## Pending user asks",
    },
    { kind: "turn-prefix" },
  ] satisfies CompactionSummaryPrompt[])(
    "retains $kind format through chunk updates and stage merge",
    async (summaryPrompt) => {
      const requests: string[] = [];
      const streamFn: StreamFn = (_model, context, options) => {
        requests.push(JSON.stringify(context));
        expect(options?.maxTokens).toBe(summaryPrompt.kind === "turn-prefix" ? 500 : 800);
        const stream = createAssistantMessageEventStream();
        stream.push({
          type: "done",
          reason: "stop",
          message: makeAgentAssistantMessage({
            content: [{ type: "text", text: `summary-${requests.length}` }],
          }),
        });
        stream.end();
        return stream;
      };
      const result = await summarizeInStages({
        messages: Array.from({ length: 4 }, (_, index) => ({
          role: "user" as const,
          content: `receipt_${index}: ${"Keep the deployment decision. ".repeat(40)}`,
          timestamp: index + 1,
        })),
        model,
        apiKey: "test-key",
        signal: new AbortController().signal,
        reserveTokens: 1_000,
        maxChunkTokens: 200,
        contextWindow: 2_000,
        summaryPrompt,
        customInstructions: "Preserve the canary decision.",
        streamFn,
      });
      expect(result).toBe(`summary-${requests.length}`);
      expect(requests.some((request) => request.includes("<previous-summary>"))).toBe(true);
      expect(requests.at(-1)).toContain("Merge these partial summaries");
      for (const request of requests) {
        expect(request).toContain(
          summaryPrompt.kind === "turn-prefix" ? "## Original Request" : "## Pending user asks",
        );
        expect(request).not.toContain("## Goal");
        expect(request).not.toContain("UPDATE the Progress section");
        expect(request).toContain("Preserve the canary decision.");
        expect(request).toContain("Preserve all opaque identifiers exactly");
      }
    },
  );

  it("retains caller format and previous summary when oversized history needs fallback", async () => {
    const requests: string[] = [];
    const streamFn: StreamFn = (_model, context) => {
      requests.push(JSON.stringify(context));
      if (requests.length === 1) {
        throw new Error("request timed out");
      }
      const stream = createAssistantMessageEventStream();
      stream.push({
        type: "done",
        reason: "stop",
        message: makeAgentAssistantMessage({
          content: [{ type: "text", text: "retained summary" }],
        }),
      });
      stream.end();
      return stream;
    };
    const result = await summarizeInStages({
      messages: [
        { role: "user", content: "x".repeat(6_000), timestamp: 1 },
        { role: "user", content: "Keep receipt_90210", timestamp: 2 },
      ],
      model,
      apiKey: "test-key",
      signal: new AbortController().signal,
      reserveTokens: 1_000,
      maxChunkTokens: 10_000,
      contextWindow: 2_000,
      parts: 1,
      summaryPrompt: { kind: "custom", instructions: "Use ## Decisions and ## Pending user asks." },
      previousSummary: "Earlier canary decision.",
      streamFn,
    });
    expect(result).toContain("retained summary");
    expect(requests).toHaveLength(2);
    expect(requests[1]).not.toContain("x".repeat(6_000));
    expect(requests[1]).toContain("Keep receipt_90210");
    for (const request of requests) {
      expect(request).toContain("## Pending user asks");
      expect(request).not.toContain("## Goal");
      expect(request).toContain("Earlier canary decision.");
      expect(request).toContain("<previous-summary>");
    }
  });
});
