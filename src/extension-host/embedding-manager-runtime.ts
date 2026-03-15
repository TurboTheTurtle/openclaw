import { resolveAgentDir } from "../agents/agent-scope.js";
import type { ResolvedMemorySearchConfig } from "../agents/memory-search.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveExtensionHostEmbeddingFallbackPolicy } from "./embedding-runtime-policy.js";
import {
  createEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingProviderId,
  type GeminiEmbeddingClient,
  type MistralEmbeddingClient,
  type OllamaEmbeddingClient,
  type OpenAiEmbeddingClient,
  type VoyageEmbeddingClient,
} from "./embedding-runtime.js";

export type EmbeddingManagerBatchConfig = {
  enabled: boolean;
  wait: boolean;
  concurrency: number;
  pollIntervalMs: number;
  timeoutMs: number;
};

export type EmbeddingManagerRuntimeState = {
  provider: EmbeddingProvider | null;
  fallbackFrom?: EmbeddingProviderId;
  openAi?: OpenAiEmbeddingClient;
  gemini?: GeminiEmbeddingClient;
  voyage?: VoyageEmbeddingClient;
  mistral?: MistralEmbeddingClient;
  ollama?: OllamaEmbeddingClient;
};

export type EmbeddingManagerFallbackActivation = EmbeddingManagerRuntimeState & {
  fallbackFrom: EmbeddingProviderId;
  fallbackReason: string;
};

export function resolveEmbeddingManagerBatchConfig(params: {
  settings: Pick<ResolvedMemorySearchConfig, "remote">;
  state: EmbeddingManagerRuntimeState;
}): EmbeddingManagerBatchConfig {
  const batch = params.settings.remote?.batch;
  const { provider } = params.state;
  const enabled = Boolean(
    batch?.enabled &&
    provider &&
    ((params.state.openAi && provider.id === "openai") ||
      (params.state.gemini && provider.id === "gemini") ||
      (params.state.voyage && provider.id === "voyage")),
  );
  return {
    enabled,
    wait: batch?.wait ?? true,
    concurrency: Math.max(1, batch?.concurrency ?? 2),
    pollIntervalMs: batch?.pollIntervalMs ?? 2000,
    timeoutMs: (batch?.timeoutMinutes ?? 60) * 60 * 1000,
  };
}

export async function activateEmbeddingManagerFallbackProvider(params: {
  cfg: OpenClawConfig;
  agentId: string;
  settings: Pick<
    ResolvedMemorySearchConfig,
    "fallback" | "local" | "model" | "outputDimensionality" | "remote"
  >;
  state: EmbeddingManagerRuntimeState;
  reason: string;
}): Promise<EmbeddingManagerFallbackActivation | null> {
  const { provider, fallbackFrom } = params.state;
  if (!provider || fallbackFrom) {
    return null;
  }
  const fallbackPolicy = resolveExtensionHostEmbeddingFallbackPolicy({
    requestedProvider: provider.id as EmbeddingProviderId,
    fallback: params.settings.fallback,
    configuredModel: params.settings.model,
  });
  if (!fallbackPolicy) {
    return null;
  }

  const result = await createEmbeddingProvider({
    config: params.cfg,
    agentDir: resolveAgentDir(params.cfg, params.agentId),
    provider: fallbackPolicy.provider,
    remote: params.settings.remote,
    model: fallbackPolicy.model,
    outputDimensionality: params.settings.outputDimensionality,
    fallback: "none",
    local: params.settings.local,
  });

  return {
    provider: result.provider,
    fallbackFrom: provider.id as EmbeddingProviderId,
    fallbackReason: params.reason,
    openAi: result.openAi,
    gemini: result.gemini,
    voyage: result.voyage,
    mistral: result.mistral,
    ollama: result.ollama,
  };
}
