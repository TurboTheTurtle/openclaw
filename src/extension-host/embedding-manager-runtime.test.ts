import { beforeEach, describe, expect, it, vi } from "vitest";

const createEmbeddingProvider = vi.hoisted(() => vi.fn());
const resolveAgentDir = vi.hoisted(() => vi.fn(() => "/tmp/agent"));

vi.mock("./embedding-runtime.js", () => ({
  createEmbeddingProvider,
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveAgentDir,
}));

describe("embedding-manager-runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the shared fallback policy for manager fallback activation", async () => {
    createEmbeddingProvider.mockResolvedValue({
      provider: {
        id: "ollama",
        model: "nomic-embed-text",
        embedQuery: vi.fn(),
        embedBatch: vi.fn(),
      },
      ollama: { kind: "ollama" },
    });

    const { activateEmbeddingManagerFallbackProvider } =
      await import("./embedding-manager-runtime.js");
    const result = await activateEmbeddingManagerFallbackProvider({
      cfg: {} as never,
      agentId: "main",
      settings: {
        fallback: "ollama",
        model: "text-embedding-3-small",
        outputDimensionality: undefined,
        remote: undefined,
        local: undefined,
      },
      state: {
        provider: {
          id: "openai",
          model: "text-embedding-3-small",
          embedQuery: vi.fn(),
          embedBatch: vi.fn(),
        },
      },
      reason: "forced fallback",
    });

    expect(createEmbeddingProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "ollama",
        model: "nomic-embed-text",
        fallback: "none",
      }),
    );
    expect(result).toMatchObject({
      fallbackFrom: "openai",
      fallbackReason: "forced fallback",
    });
  });
});
