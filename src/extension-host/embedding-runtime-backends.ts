import type { EmbeddingProviderId } from "./embedding-runtime-types.js";

export const DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL =
  "hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf";

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
