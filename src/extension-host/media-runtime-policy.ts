import type { MediaUnderstandingCapability } from "../media-understanding/types.js";
import { normalizeExtensionHostMediaProviderId } from "./media-runtime-registry.js";
import {
  listExtensionHostMediaRuntimeBackendCatalogEntries,
  resolveExtensionHostMediaRuntimeDefaultModel,
} from "./runtime-backend-catalog.js";
import { resolveExtensionHostRuntimeBackendIdsByPolicy } from "./runtime-backend-policy.js";

export type ExtensionHostMediaActiveModel = {
  provider: string;
  model?: string;
};

export type ExtensionHostMediaProviderCandidate = {
  provider: string;
  model?: string;
};

function resolveExtensionHostMediaRuntimeSubsystemId(
  capability: MediaUnderstandingCapability,
): "media.audio" | "media.image" | "media.video" {
  if (capability === "audio") {
    return "media.audio";
  }
  if (capability === "video") {
    return "media.video";
  }
  return "media.image";
}

function resolveExtensionHostMediaCandidateModel(params: {
  capability: MediaUnderstandingCapability;
  provider: string;
  activeModel?: ExtensionHostMediaActiveModel;
}): string | undefined {
  const activeProvider = params.activeModel?.provider?.trim();
  if (
    activeProvider &&
    normalizeExtensionHostMediaProviderId(activeProvider) ===
      normalizeExtensionHostMediaProviderId(params.provider)
  ) {
    return params.activeModel?.model;
  }
  return resolveExtensionHostMediaRuntimeDefaultModel({
    capability: params.capability,
    backendId: params.provider,
  });
}

export function resolveExtensionHostMediaProviderCandidates(params: {
  capability: MediaUnderstandingCapability;
  activeModel?: ExtensionHostMediaActiveModel;
}): readonly ExtensionHostMediaProviderCandidate[] {
  const candidates: ExtensionHostMediaProviderCandidate[] = [];
  const preferredProvider = params.activeModel?.provider?.trim()
    ? normalizeExtensionHostMediaProviderId(params.activeModel.provider)
    : undefined;
  for (const provider of resolveExtensionHostRuntimeBackendIdsByPolicy({
    entries: listExtensionHostMediaRuntimeBackendCatalogEntries(),
    subsystemId: resolveExtensionHostMediaRuntimeSubsystemId(params.capability),
    preferredBackendId: preferredProvider,
    include: (entry) => entry.metadata?.autoSelectable === true,
  })) {
    const normalized = normalizeExtensionHostMediaProviderId(provider);
    candidates.push({
      provider: normalized,
      model: resolveExtensionHostMediaCandidateModel({
        capability: params.capability,
        provider: normalized,
        activeModel: params.activeModel,
      }),
    });
  }

  return candidates;
}
