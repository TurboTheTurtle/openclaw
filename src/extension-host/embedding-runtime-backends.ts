import type { EmbeddingProviderId } from "./embedding-runtime-types.js";

export const DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL =
  "hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf";
export const DEFAULT_EXTENSION_HOST_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EXTENSION_HOST_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_EXTENSION_HOST_VOYAGE_EMBEDDING_MODEL = "voyage-4-large";
export const DEFAULT_EXTENSION_HOST_MISTRAL_EMBEDDING_MODEL = "mistral-embed";
export const DEFAULT_EXTENSION_HOST_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

export const EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS = [
  "openai",
  "gemini",
  "voyage",
  "mistral",
] as const satisfies readonly EmbeddingProviderId[];

export const EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS = [
  "local",
  ...EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS,
  "ollama",
] as const satisfies readonly EmbeddingProviderId[];

export function isExtensionHostEmbeddingRuntimeBackendAutoSelectable(
  backendId: EmbeddingProviderId,
): boolean {
  return backendId === "local" || EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS.includes(backendId);
}

export function resolveExtensionHostEmbeddingRuntimeDefaultModel(
  backendId: EmbeddingProviderId,
): string {
  switch (backendId) {
    case "openai":
      return DEFAULT_EXTENSION_HOST_OPENAI_EMBEDDING_MODEL;
    case "gemini":
      return DEFAULT_EXTENSION_HOST_GEMINI_EMBEDDING_MODEL;
    case "voyage":
      return DEFAULT_EXTENSION_HOST_VOYAGE_EMBEDDING_MODEL;
    case "mistral":
      return DEFAULT_EXTENSION_HOST_MISTRAL_EMBEDDING_MODEL;
    case "ollama":
      return DEFAULT_EXTENSION_HOST_OLLAMA_EMBEDDING_MODEL;
    case "local":
      return DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL;
  }
}
