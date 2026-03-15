import { resolveExtensionHostEmbeddingRuntimeDefaultModel } from "./embedding-runtime-backends.js";
import type {
  EmbeddingProviderFallback,
  EmbeddingProviderId,
  EmbeddingProviderRequest,
} from "./embedding-runtime-types.js";

export function resolveExtensionHostEmbeddingFallbackPolicy(params: {
  requestedProvider: EmbeddingProviderRequest | EmbeddingProviderId;
  fallback: EmbeddingProviderFallback | undefined;
  configuredModel: string;
}): {
  provider: EmbeddingProviderId;
  model: string;
} | null {
  const fallback = params.fallback;
  if (!fallback || fallback === "none" || fallback === params.requestedProvider) {
    return null;
  }
  return {
    provider: fallback,
    model: resolveExtensionHostEmbeddingFallbackModel(fallback, params.configuredModel),
  };
}

export function resolveExtensionHostEmbeddingFallbackModel(
  fallback: Exclude<EmbeddingProviderFallback, "none">,
  configuredModel: string,
): string {
  return fallback === "local"
    ? configuredModel
    : resolveExtensionHostEmbeddingRuntimeDefaultModel(fallback);
}
