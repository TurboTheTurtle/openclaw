import { beforeEach, describe, expect, it, vi } from "vitest";

const listExtensionHostEmbeddingRemoteRuntimeBackendIds = vi.hoisted(() =>
  vi.fn(() => ["gemini", "openai"] as const),
);
const createGeminiEmbeddingProvider = vi.hoisted(() => vi.fn());
const createOpenAiEmbeddingProvider = vi.hoisted(() => vi.fn());

vi.mock("./runtime-backend-catalog.js", () => ({
  listExtensionHostEmbeddingRemoteRuntimeBackendIds,
}));

vi.mock("../memory/embeddings-gemini.js", () => ({
  createGeminiEmbeddingProvider,
}));

vi.mock("../memory/embeddings-openai.js", () => ({
  createOpenAiEmbeddingProvider,
}));

vi.mock("../memory/embeddings-mistral.js", () => ({
  createMistralEmbeddingProvider: vi.fn(),
}));

vi.mock("../memory/embeddings-ollama.js", () => ({
  createOllamaEmbeddingProvider: vi.fn(),
}));

vi.mock("../memory/embeddings-voyage.js", () => ({
  createVoyageEmbeddingProvider: vi.fn(),
}));

vi.mock("../memory/node-llama.js", () => ({
  importNodeLlamaCpp: vi.fn(),
}));

describe("extension host embedding runtime registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the runtime-backend catalog for auto provider order", async () => {
    createGeminiEmbeddingProvider.mockResolvedValue({
      provider: {
        id: "gemini",
        model: "gemini-embedding-001",
        embedQuery: vi.fn(),
        embedBatch: vi.fn(),
      },
      client: { kind: "gemini" },
    });

    const { createExtensionHostEmbeddingProvider } =
      await import("./embedding-runtime-registry.js");
    const result = await createExtensionHostEmbeddingProvider({
      config: {} as never,
      provider: "auto",
      model: "gemini-embedding-001",
      fallback: "none",
    });

    expect(listExtensionHostEmbeddingRemoteRuntimeBackendIds).toHaveBeenCalledTimes(1);
    expect(createGeminiEmbeddingProvider).toHaveBeenCalledTimes(1);
    expect(createOpenAiEmbeddingProvider).not.toHaveBeenCalled();
    expect(result.provider?.id).toBe("gemini");
  });

  it("uses the same catalog order in local setup guidance", async () => {
    const { formatExtensionHostLocalEmbeddingSetupError } =
      await import("./embedding-runtime-registry.js");

    const message = formatExtensionHostLocalEmbeddingSetupError(
      new Error("Cannot find package 'node-llama-cpp'"),
    );

    expect(listExtensionHostEmbeddingRemoteRuntimeBackendIds).toHaveBeenCalledTimes(1);
    expect(message).toContain('agents.defaults.memorySearch.provider = "gemini"');
    expect(message).toContain('agents.defaults.memorySearch.provider = "openai"');
  });

  it("uses the shared fallback policy for explicit provider fallback requests", async () => {
    createOpenAiEmbeddingProvider.mockRejectedValueOnce(new Error("openai failed"));
    createGeminiEmbeddingProvider.mockResolvedValueOnce({
      provider: {
        id: "gemini",
        model: "gemini-embedding-001",
        embedQuery: vi.fn(),
        embedBatch: vi.fn(),
      },
      client: { kind: "gemini" },
    });

    const { createExtensionHostEmbeddingProvider } =
      await import("./embedding-runtime-registry.js");
    const result = await createExtensionHostEmbeddingProvider({
      config: {} as never,
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "gemini",
    });

    expect(createGeminiEmbeddingProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "gemini",
        model: "gemini-embedding-001",
        fallback: "none",
      }),
    );
    expect(result.fallbackFrom).toBe("openai");
    expect(result.provider?.id).toBe("gemini");
  });
});
