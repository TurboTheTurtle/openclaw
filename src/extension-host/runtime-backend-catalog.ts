import type { TtsProvider } from "../config/types.tts.js";
import {
  AUTO_AUDIO_KEY_PROVIDERS,
  AUTO_IMAGE_KEY_PROVIDERS,
  AUTO_VIDEO_KEY_PROVIDERS,
  DEFAULT_AUDIO_MODELS,
  DEFAULT_IMAGE_MODELS,
} from "../media-understanding/defaults.js";
import type { MediaUnderstandingCapability } from "../media-understanding/types.js";
import {
  EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS,
  isExtensionHostEmbeddingRuntimeBackendAutoSelectable,
} from "./embedding-runtime-backends.js";
import type { EmbeddingProviderId } from "./embedding-runtime-types.js";
import {
  buildExtensionHostMediaUnderstandingRegistry,
  normalizeExtensionHostMediaProviderId,
} from "./media-runtime-registry.js";
import { listExtensionHostTtsRuntimeBackends } from "./tts-runtime-backends.js";

export const EXTENSION_HOST_RUNTIME_BACKEND_FAMILY = "capability.runtime-backend";

export type ExtensionHostRuntimeBackendFamily = typeof EXTENSION_HOST_RUNTIME_BACKEND_FAMILY;

export type ExtensionHostRuntimeBackendSubsystemId =
  | "embedding"
  | "media.audio"
  | "media.image"
  | "media.video"
  | "tts";

export type ExtensionHostRuntimeBackendCatalogEntry = {
  id: string;
  family: ExtensionHostRuntimeBackendFamily;
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  backendId: string;
  source: "builtin";
  defaultRank: number;
  selectorKeys: readonly string[];
  capabilities: readonly string[];
  metadata?: Record<string, unknown>;
};

type ExtensionHostMediaRuntimeSubsystemId = Extract<
  ExtensionHostRuntimeBackendSubsystemId,
  "media.audio" | "media.image" | "media.video"
>;

const EXTENSION_HOST_MEDIA_AUTO_PROVIDER_IDS: Record<
  MediaUnderstandingCapability,
  readonly string[]
> = {
  audio: AUTO_AUDIO_KEY_PROVIDERS,
  image: AUTO_IMAGE_KEY_PROVIDERS,
  video: AUTO_VIDEO_KEY_PROVIDERS,
};

function buildRuntimeBackendCatalogId(
  subsystemId: ExtensionHostRuntimeBackendSubsystemId,
  backendId: string,
): string {
  return `${EXTENSION_HOST_RUNTIME_BACKEND_FAMILY}:${subsystemId}:${backendId}`;
}

function mapMediaCapabilityToSubsystem(
  capability: MediaUnderstandingCapability,
): ExtensionHostRuntimeBackendSubsystemId {
  if (capability === "audio") {
    return "media.audio";
  }
  if (capability === "video") {
    return "media.video";
  }
  return "media.image";
}

function buildMediaSelectorKeys(providerId: string): readonly string[] {
  const normalized = normalizeExtensionHostMediaProviderId(providerId);
  if (normalized === "google") {
    return [providerId, "gemini"];
  }
  return normalized === providerId ? [providerId] : [providerId, normalized];
}

function buildExtensionHostMediaRuntimeProviderIds(
  capability: MediaUnderstandingCapability,
): readonly string[] {
  const registry = buildExtensionHostMediaUnderstandingRegistry();
  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushProvider = (providerId: string) => {
    const normalized = normalizeExtensionHostMediaProviderId(providerId);
    const provider = registry.get(normalized);
    if (!provider || seen.has(normalized) || !(provider.capabilities ?? []).includes(capability)) {
      return;
    }
    seen.add(normalized);
    ordered.push(normalized);
  };

  for (const providerId of EXTENSION_HOST_MEDIA_AUTO_PROVIDER_IDS[capability]) {
    pushProvider(providerId);
  }
  for (const provider of registry.values()) {
    pushProvider(provider.id);
  }
  return ordered;
}

function resolveExtensionHostMediaRuntimeDefaultModelFromDefaults(params: {
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

export function listExtensionHostEmbeddingRuntimeBackendCatalogEntries(): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  return EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS.map((backendId, defaultRank) => ({
    id: buildRuntimeBackendCatalogId("embedding", backendId),
    family: EXTENSION_HOST_RUNTIME_BACKEND_FAMILY,
    subsystemId: "embedding",
    backendId,
    source: "builtin",
    defaultRank,
    selectorKeys: [backendId],
    capabilities: ["embed.query", "embed.batch"],
    metadata: {
      autoSelectable: isExtensionHostEmbeddingRuntimeBackendAutoSelectable(backendId),
    },
  }));
}

export function listExtensionHostEmbeddingRemoteRuntimeBackendIds(): readonly EmbeddingProviderId[] {
  return listExtensionHostEmbeddingRuntimeBackendCatalogEntries()
    .filter((entry) => entry.backendId !== "local" && entry.metadata?.autoSelectable === true)
    .map((entry) => entry.backendId as EmbeddingProviderId);
}

export function listExtensionHostMediaRuntimeBackendCatalogEntries(): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  const entries: ExtensionHostRuntimeBackendCatalogEntry[] = [];
  const registry = buildExtensionHostMediaUnderstandingRegistry();
  for (const capability of ["audio", "image", "video"] as const) {
    const providerIds = buildExtensionHostMediaRuntimeProviderIds(capability);
    for (const [defaultRank, providerId] of providerIds.entries()) {
      const provider = registry.get(providerId);
      if (!provider) {
        continue;
      }
      const defaultModel = resolveExtensionHostMediaRuntimeDefaultModelFromDefaults({
        capability,
        backendId: providerId,
      });
      entries.push({
        id: buildRuntimeBackendCatalogId(mapMediaCapabilityToSubsystem(capability), provider.id),
        family: EXTENSION_HOST_RUNTIME_BACKEND_FAMILY,
        subsystemId: mapMediaCapabilityToSubsystem(capability),
        backendId: provider.id,
        source: "builtin",
        defaultRank,
        selectorKeys: buildMediaSelectorKeys(provider.id),
        capabilities: [capability],
        metadata: {
          autoSelectable: EXTENSION_HOST_MEDIA_AUTO_PROVIDER_IDS[capability].includes(provider.id),
          ...(defaultModel ? { defaultModel } : {}),
        },
      });
    }
  }
  return entries;
}

export function listExtensionHostMediaAutoRuntimeBackendIds(
  capability: MediaUnderstandingCapability,
): readonly string[] {
  const subsystemId = mapMediaCapabilityToSubsystem(capability);
  return listExtensionHostMediaRuntimeBackendCatalogEntries()
    .filter((entry) => entry.subsystemId === subsystemId && entry.metadata?.autoSelectable === true)
    .toSorted((left, right) => left.defaultRank - right.defaultRank)
    .map((entry) => entry.backendId);
}

export function resolveExtensionHostMediaRuntimeDefaultModel(params: {
  capability: MediaUnderstandingCapability;
  backendId: string;
}): string | undefined {
  const subsystemId = mapMediaCapabilityToSubsystem(params.capability);
  const entry = listExtensionHostMediaRuntimeBackendCatalogEntries().find(
    (candidate) =>
      candidate.subsystemId === subsystemId && candidate.backendId === params.backendId,
  );
  const defaultModel = entry?.metadata?.defaultModel;
  return typeof defaultModel === "string" ? defaultModel : undefined;
}

export function listExtensionHostTtsRuntimeBackendCatalogEntries(): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  return listExtensionHostTtsRuntimeBackends().map((provider, defaultRank) => ({
    id: buildRuntimeBackendCatalogId("tts", provider.id),
    family: EXTENSION_HOST_RUNTIME_BACKEND_FAMILY,
    subsystemId: "tts",
    backendId: provider.id,
    source: "builtin",
    defaultRank,
    selectorKeys: [provider.id],
    capabilities: provider.supportsTelephony
      ? ["tts.synthesis", "tts.telephony"]
      : ["tts.synthesis"],
    metadata: {
      supportsTelephony: provider.supportsTelephony,
    },
  }));
}

export function listExtensionHostTtsRuntimeBackendIds(): readonly TtsProvider[] {
  return listExtensionHostTtsRuntimeBackendCatalogEntries().map(
    (entry) => entry.backendId as TtsProvider,
  );
}

export function listExtensionHostRuntimeBackendIdsForSubsystem(
  subsystemId: ExtensionHostRuntimeBackendSubsystemId,
): readonly string[] {
  return listExtensionHostRuntimeBackendCatalogEntries()
    .filter((entry) => entry.subsystemId === subsystemId)
    .toSorted((left, right) => left.defaultRank - right.defaultRank)
    .map((entry) => entry.backendId);
}

export function resolveExtensionHostRuntimeBackendOrderForSubsystem(
  subsystemId: ExtensionHostRuntimeBackendSubsystemId,
  preferredBackendId: string,
): readonly string[] {
  const ordered = listExtensionHostRuntimeBackendIdsForSubsystem(subsystemId);
  if (!ordered.includes(preferredBackendId)) {
    return [preferredBackendId, ...ordered];
  }
  return [preferredBackendId, ...ordered.filter((backendId) => backendId !== preferredBackendId)];
}

export function listExtensionHostMediaRuntimeBackendIds(
  subsystemId: ExtensionHostMediaRuntimeSubsystemId,
): readonly string[] {
  return listExtensionHostRuntimeBackendIdsForSubsystem(subsystemId);
}

export function resolveExtensionHostTtsRuntimeBackendOrder(
  preferredBackendId: TtsProvider,
): readonly TtsProvider[] {
  return resolveExtensionHostRuntimeBackendOrderForSubsystem("tts", preferredBackendId).map(
    (backendId) => backendId as TtsProvider,
  );
}

export function listExtensionHostRuntimeBackendCatalogEntries(): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  return [
    ...listExtensionHostEmbeddingRuntimeBackendCatalogEntries(),
    ...listExtensionHostMediaRuntimeBackendCatalogEntries(),
    ...listExtensionHostTtsRuntimeBackendCatalogEntries(),
  ];
}

export function getExtensionHostRuntimeBackendCatalogEntry(params: {
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  backendId: string;
}): ExtensionHostRuntimeBackendCatalogEntry | undefined {
  return listExtensionHostRuntimeBackendCatalogEntries().find(
    (entry) => entry.subsystemId === params.subsystemId && entry.backendId === params.backendId,
  );
}
