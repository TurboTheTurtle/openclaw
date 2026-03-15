import { DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL } from "./embedding-runtime-backends.js";
import { createExtensionHostEmbeddingProvider } from "./embedding-runtime-registry.js";
import type {
  EmbeddingProviderOptions,
  EmbeddingProviderResult,
} from "./embedding-runtime-types.js";

export type {
  EmbeddingProvider,
  EmbeddingProviderFallback,
  EmbeddingProviderId,
  EmbeddingProviderOptions,
  EmbeddingProviderRequest,
  EmbeddingProviderResult,
  GeminiEmbeddingClient,
  MistralEmbeddingClient,
  OllamaEmbeddingClient,
  OpenAiEmbeddingClient,
  VoyageEmbeddingClient,
} from "./embedding-runtime-types.js";

export const DEFAULT_LOCAL_EMBEDDING_MODEL = DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL;

export async function createEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<EmbeddingProviderResult> {
  return createExtensionHostEmbeddingProvider(options);
}
