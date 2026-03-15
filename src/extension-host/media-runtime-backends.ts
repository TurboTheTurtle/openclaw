import { normalizeProviderId } from "../agents/provider-id.js";
import {
  AUTO_AUDIO_KEY_PROVIDERS,
  AUTO_IMAGE_KEY_PROVIDERS,
  AUTO_VIDEO_KEY_PROVIDERS,
  DEFAULT_AUDIO_MODELS,
  DEFAULT_IMAGE_MODELS,
} from "../media-understanding/defaults.js";
import { anthropicProvider } from "../media-understanding/providers/anthropic/index.js";
import { deepgramProvider } from "../media-understanding/providers/deepgram/index.js";
import { googleProvider } from "../media-understanding/providers/google/index.js";
import { groqProvider } from "../media-understanding/providers/groq/index.js";
import {
  minimaxPortalProvider,
  minimaxProvider,
} from "../media-understanding/providers/minimax/index.js";
import { mistralProvider } from "../media-understanding/providers/mistral/index.js";
import { moonshotProvider } from "../media-understanding/providers/moonshot/index.js";
import { openaiProvider } from "../media-understanding/providers/openai/index.js";
import { zaiProvider } from "../media-understanding/providers/zai/index.js";
import type {
  MediaUnderstandingCapability,
  MediaUnderstandingProvider,
} from "../media-understanding/types.js";

const EXTENSION_HOST_MEDIA_UNDERSTANDING_PROVIDERS: readonly MediaUnderstandingProvider[] = [
  groqProvider,
  openaiProvider,
  googleProvider,
  anthropicProvider,
  minimaxProvider,
  minimaxPortalProvider,
  moonshotProvider,
  mistralProvider,
  zaiProvider,
  deepgramProvider,
];

const EXTENSION_HOST_MEDIA_AUTO_RUNTIME_BACKEND_IDS: Record<
  MediaUnderstandingCapability,
  readonly string[]
> = {
  audio: AUTO_AUDIO_KEY_PROVIDERS,
  image: AUTO_IMAGE_KEY_PROVIDERS,
  video: AUTO_VIDEO_KEY_PROVIDERS,
};

export function listExtensionHostMediaUnderstandingProviders(): readonly MediaUnderstandingProvider[] {
  return EXTENSION_HOST_MEDIA_UNDERSTANDING_PROVIDERS;
}

export function normalizeExtensionHostMediaProviderId(id: string): string {
  const normalized = normalizeProviderId(id);
  if (normalized === "gemini") {
    return "google";
  }
  return normalized;
}

export function buildExtensionHostMediaRuntimeSelectorKeys(providerId: string): readonly string[] {
  const normalized = normalizeExtensionHostMediaProviderId(providerId);
  if (normalized === "google") {
    return [providerId, "gemini"];
  }
  return normalized === providerId ? [providerId] : [providerId, normalized];
}

export function listExtensionHostMediaAutoRuntimeBackendSeedIds(
  capability: MediaUnderstandingCapability,
): readonly string[] {
  return EXTENSION_HOST_MEDIA_AUTO_RUNTIME_BACKEND_IDS[capability];
}

export function listExtensionHostMediaRuntimeBackendIds(
  capability: MediaUnderstandingCapability,
): readonly string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushProvider = (provider: MediaUnderstandingProvider | undefined) => {
    if (!provider || !(provider.capabilities ?? []).includes(capability)) {
      return;
    }
    const normalized = normalizeExtensionHostMediaProviderId(provider.id);
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ordered.push(normalized);
  };

  const providersById = new Map(
    listExtensionHostMediaUnderstandingProviders().map((provider) => [
      normalizeExtensionHostMediaProviderId(provider.id),
      provider,
    ]),
  );

  for (const providerId of listExtensionHostMediaAutoRuntimeBackendSeedIds(capability)) {
    pushProvider(providersById.get(normalizeExtensionHostMediaProviderId(providerId)));
  }
  for (const provider of providersById.values()) {
    pushProvider(provider);
  }
  return ordered;
}

export function resolveExtensionHostMediaRuntimeDefaultModelMetadata(params: {
  capability: MediaUnderstandingCapability;
  backendId: string;
}): string | undefined {
  if (params.capability === "audio") {
    return DEFAULT_AUDIO_MODELS[params.backendId];
  }
  if (params.capability === "image") {
    return DEFAULT_IMAGE_MODELS[params.backendId];
  }
  return undefined;
}
