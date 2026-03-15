import fsSync from "node:fs";
import type { Llama, LlamaEmbeddingContext, LlamaModel } from "node-llama-cpp";
import { formatErrorMessage } from "../infra/errors.js";
import { sanitizeAndNormalizeEmbedding } from "../memory/embedding-vectors.js";
import {
  createGeminiEmbeddingProvider,
  type GeminiEmbeddingClient,
  type GeminiTaskType,
} from "../memory/embeddings-gemini.js";
import {
  createMistralEmbeddingProvider,
  type MistralEmbeddingClient,
} from "../memory/embeddings-mistral.js";
import {
  createOllamaEmbeddingProvider,
  type OllamaEmbeddingClient,
} from "../memory/embeddings-ollama.js";
import {
  createOpenAiEmbeddingProvider,
  type OpenAiEmbeddingClient,
} from "../memory/embeddings-openai.js";
import {
  createVoyageEmbeddingProvider,
  type VoyageEmbeddingClient,
} from "../memory/embeddings-voyage.js";
import { importNodeLlamaCpp } from "../memory/node-llama.js";
import { resolveUserPath } from "../utils.js";
import {
  DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL,
  EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS,
} from "./embedding-runtime-backends.js";
import type {
  EmbeddingProvider,
  EmbeddingProviderId,
  EmbeddingProviderOptions,
  EmbeddingProviderResult,
} from "./embedding-runtime-types.js";

export type {
  GeminiEmbeddingClient,
  GeminiTaskType,
  MistralEmbeddingClient,
  OllamaEmbeddingClient,
  OpenAiEmbeddingClient,
  VoyageEmbeddingClient,
};

export function canAutoSelectExtensionHostLocalEmbedding(
  options: EmbeddingProviderOptions,
): boolean {
  const modelPath = options.local?.modelPath?.trim();
  if (!modelPath) {
    return false;
  }
  if (/^(hf:|https?:)/i.test(modelPath)) {
    return false;
  }
  const resolved = resolveUserPath(modelPath);
  try {
    return fsSync.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

export function isMissingExtensionHostEmbeddingApiKeyError(err: unknown): boolean {
  const message = formatErrorMessage(err);
  return message.includes("No API key found for provider");
}

async function createExtensionHostLocalEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<EmbeddingProvider> {
  const modelPath =
    options.local?.modelPath?.trim() || DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL;
  const modelCacheDir = options.local?.modelCacheDir?.trim();

  // Lazy-load node-llama-cpp to keep startup light unless local is enabled.
  const { getLlama, resolveModelFile, LlamaLogLevel } = await importNodeLlamaCpp();

  let llama: Llama | null = null;
  let embeddingModel: LlamaModel | null = null;
  let embeddingContext: LlamaEmbeddingContext | null = null;
  let initPromise: Promise<LlamaEmbeddingContext> | null = null;

  const ensureContext = async (): Promise<LlamaEmbeddingContext> => {
    if (embeddingContext) {
      return embeddingContext;
    }
    if (initPromise) {
      return initPromise;
    }
    initPromise = (async () => {
      try {
        if (!llama) {
          llama = await getLlama({ logLevel: LlamaLogLevel.error });
        }
        if (!embeddingModel) {
          const resolved = await resolveModelFile(modelPath, modelCacheDir || undefined);
          embeddingModel = await llama.loadModel({ modelPath: resolved });
        }
        if (!embeddingContext) {
          embeddingContext = await embeddingModel.createEmbeddingContext();
        }
        return embeddingContext;
      } catch (err) {
        initPromise = null;
        throw err;
      }
    })();
    return initPromise;
  };

  return {
    id: "local",
    model: modelPath,
    embedQuery: async (text) => {
      const ctx = await ensureContext();
      const embedding = await ctx.getEmbeddingFor(text);
      return sanitizeAndNormalizeEmbedding(Array.from(embedding.vector));
    },
    embedBatch: async (texts) => {
      const ctx = await ensureContext();
      return Promise.all(
        texts.map(async (text) => {
          const embedding = await ctx.getEmbeddingFor(text);
          return sanitizeAndNormalizeEmbedding(Array.from(embedding.vector));
        }),
      );
    },
  };
}

async function createExtensionHostEmbeddingProviderById(
  id: EmbeddingProviderId,
  options: EmbeddingProviderOptions,
): Promise<
  Omit<
    EmbeddingProviderResult,
    "requestedProvider" | "fallbackFrom" | "fallbackReason" | "providerUnavailableReason"
  >
> {
  if (id === "local") {
    const provider = await createExtensionHostLocalEmbeddingProvider(options);
    return { provider };
  }
  if (id === "ollama") {
    const { provider, client } = await createOllamaEmbeddingProvider(options);
    return { provider, ollama: client };
  }
  if (id === "gemini") {
    const { provider, client } = await createGeminiEmbeddingProvider(options);
    return { provider, gemini: client };
  }
  if (id === "voyage") {
    const { provider, client } = await createVoyageEmbeddingProvider(options);
    return { provider, voyage: client };
  }
  if (id === "mistral") {
    const { provider, client } = await createMistralEmbeddingProvider(options);
    return { provider, mistral: client };
  }
  const { provider, client } = await createOpenAiEmbeddingProvider(options);
  return { provider, openAi: client };
}

function formatExtensionHostPrimaryEmbeddingError(
  err: unknown,
  provider: EmbeddingProviderId,
): string {
  return provider === "local"
    ? formatExtensionHostLocalEmbeddingSetupError(err)
    : formatErrorMessage(err);
}

export async function createExtensionHostEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<EmbeddingProviderResult> {
  const requestedProvider = options.provider;
  const fallback = options.fallback;

  if (requestedProvider === "auto") {
    const missingKeyErrors: string[] = [];
    let localError: string | null = null;

    if (canAutoSelectExtensionHostLocalEmbedding(options)) {
      try {
        const local = await createExtensionHostEmbeddingProviderById("local", options);
        return { ...local, requestedProvider };
      } catch (err) {
        localError = formatExtensionHostLocalEmbeddingSetupError(err);
      }
    }

    for (const provider of EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS) {
      try {
        const result = await createExtensionHostEmbeddingProviderById(provider, options);
        return { ...result, requestedProvider };
      } catch (err) {
        const message = formatExtensionHostPrimaryEmbeddingError(err, provider);
        if (isMissingExtensionHostEmbeddingApiKeyError(err)) {
          missingKeyErrors.push(message);
          continue;
        }
        const wrapped = new Error(message) as Error & { cause?: unknown };
        wrapped.cause = err;
        throw wrapped;
      }
    }

    const details = [...missingKeyErrors, localError].filter(Boolean) as string[];
    const reason = details.length > 0 ? details.join("\n\n") : "No embeddings provider available.";
    return {
      provider: null,
      requestedProvider,
      providerUnavailableReason: reason,
    };
  }

  try {
    const primary = await createExtensionHostEmbeddingProviderById(requestedProvider, options);
    return { ...primary, requestedProvider };
  } catch (primaryErr) {
    const reason = formatExtensionHostPrimaryEmbeddingError(primaryErr, requestedProvider);
    if (fallback && fallback !== "none" && fallback !== requestedProvider) {
      try {
        const fallbackResult = await createExtensionHostEmbeddingProviderById(fallback, options);
        return {
          ...fallbackResult,
          requestedProvider,
          fallbackFrom: requestedProvider,
          fallbackReason: reason,
        };
      } catch (fallbackErr) {
        const fallbackReason = formatErrorMessage(fallbackErr);
        const combinedReason = `${reason}\n\nFallback to ${fallback} failed: ${fallbackReason}`;
        if (
          isMissingExtensionHostEmbeddingApiKeyError(primaryErr) &&
          isMissingExtensionHostEmbeddingApiKeyError(fallbackErr)
        ) {
          return {
            provider: null,
            requestedProvider,
            fallbackFrom: requestedProvider,
            fallbackReason: reason,
            providerUnavailableReason: combinedReason,
          };
        }
        const wrapped = new Error(combinedReason) as Error & { cause?: unknown };
        wrapped.cause = fallbackErr;
        throw wrapped;
      }
    }
    if (isMissingExtensionHostEmbeddingApiKeyError(primaryErr)) {
      return {
        provider: null,
        requestedProvider,
        providerUnavailableReason: reason,
      };
    }
    const wrapped = new Error(reason) as Error & { cause?: unknown };
    wrapped.cause = primaryErr;
    throw wrapped;
  }
}

function isNodeLlamaCppMissing(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const code = (err as Error & { code?: unknown }).code;
  if (code === "ERR_MODULE_NOT_FOUND") {
    return err.message.includes("node-llama-cpp");
  }
  return false;
}

export function formatExtensionHostLocalEmbeddingSetupError(err: unknown): string {
  const detail = formatErrorMessage(err);
  const missing = isNodeLlamaCppMissing(err);
  return [
    "Local embeddings unavailable.",
    missing
      ? "Reason: optional dependency node-llama-cpp is missing (or failed to install)."
      : detail
        ? `Reason: ${detail}`
        : undefined,
    missing && detail ? `Detail: ${detail}` : null,
    "To enable local embeddings:",
    "1) Use Node 24 (recommended for installs/updates; Node 22 LTS, currently 22.16+, remains supported)",
    missing
      ? "2) Reinstall OpenClaw (this should install node-llama-cpp): npm i -g openclaw@latest"
      : null,
    "3) If you use pnpm: pnpm approve-builds (select node-llama-cpp), then pnpm rebuild node-llama-cpp",
    ...EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS.map(
      (provider) => `Or set agents.defaults.memorySearch.provider = "${provider}" (remote).`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
