import type { TtsProvider } from "../config/types.tts.js";
import type { MediaUnderstandingCapability } from "../media-understanding/types.js";
import {
  EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS,
  isExtensionHostEmbeddingRuntimeBackendAutoSelectable,
} from "./embedding-runtime-backends.js";
import type { EmbeddingProviderId } from "./embedding-runtime-types.js";
import {
  buildExtensionHostMediaRuntimeSelectorKeys,
  listExtensionHostMediaAutoRuntimeBackendSeedIds,
  listExtensionHostMediaRuntimeBackendIds as listExtensionHostMediaRuntimeBackendIdsFromDefinitions,
  normalizeExtensionHostMediaProviderId,
  resolveExtensionHostMediaRuntimeDefaultModelMetadata,
} from "./media-runtime-backends.js";
import {
  listExtensionHostRuntimeBackendIdsByArbitration,
  resolveExtensionHostRuntimeBackendOrderByArbitration,
} from "./runtime-backend-arbitration.js";
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
  return listExtensionHostRuntimeBackendIdsByArbitration({
    entries: listExtensionHostEmbeddingRuntimeBackendCatalogEntries(),
    subsystemId: "embedding",
    include: (entry) => entry.backendId !== "local" && entry.metadata?.autoSelectable === true,
  }).map((entry) => entry as EmbeddingProviderId);
}

export function listExtensionHostMediaRuntimeBackendCatalogEntries(): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  const entries: ExtensionHostRuntimeBackendCatalogEntry[] = [];
  for (const capability of ["audio", "image", "video"] as const) {
    const providerIds = listExtensionHostMediaRuntimeBackendIdsFromDefinitions(capability);
    for (const [defaultRank, providerId] of providerIds.entries()) {
      const defaultModel = resolveExtensionHostMediaRuntimeDefaultModelMetadata({
        capability,
        backendId: providerId,
      });
      entries.push({
        id: buildRuntimeBackendCatalogId(mapMediaCapabilityToSubsystem(capability), providerId),
        family: EXTENSION_HOST_RUNTIME_BACKEND_FAMILY,
        subsystemId: mapMediaCapabilityToSubsystem(capability),
        backendId: providerId,
        source: "builtin",
        defaultRank,
        selectorKeys: buildExtensionHostMediaRuntimeSelectorKeys(providerId),
        capabilities: [capability],
        metadata: {
          autoSelectable: listExtensionHostMediaAutoRuntimeBackendSeedIds(capability).includes(
            normalizeExtensionHostMediaProviderId(providerId),
          ),
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
  return listExtensionHostRuntimeBackendIdsByArbitration({
    entries: listExtensionHostMediaRuntimeBackendCatalogEntries(),
    subsystemId,
    include: (entry) => entry.metadata?.autoSelectable === true,
  });
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
  return listExtensionHostRuntimeBackendIdsByArbitration({
    entries: listExtensionHostRuntimeBackendCatalogEntries(),
    subsystemId,
  });
}

export function resolveExtensionHostRuntimeBackendOrderForSubsystem(
  subsystemId: ExtensionHostRuntimeBackendSubsystemId,
  preferredBackendId: string,
): readonly string[] {
  return resolveExtensionHostRuntimeBackendOrderByArbitration({
    entries: listExtensionHostRuntimeBackendCatalogEntries(),
    subsystemId,
    preferredBackendId,
  });
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
