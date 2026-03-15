import type { TtsProvider } from "../config/types.tts.js";
import {
  listExtensionHostTtsRuntimeBackendCatalogEntries,
  type ExtensionHostRuntimeBackendCatalogEntry,
} from "./runtime-backend-catalog.js";
import { resolveExtensionHostRuntimeBackendIdsByPolicy } from "./runtime-backend-policy.js";
import type { ResolvedTtsConfig } from "./tts-config.js";
import { isExtensionHostTtsProviderConfigured } from "./tts-runtime-registry.js";

function isConfiguredTtsRuntimeBackend(
  config: ResolvedTtsConfig,
  entry: ExtensionHostRuntimeBackendCatalogEntry,
): boolean {
  return isExtensionHostTtsProviderConfigured(config, entry.backendId as TtsProvider);
}

export function resolveExtensionHostDefaultTtsProvider(config: ResolvedTtsConfig): TtsProvider {
  return (resolveExtensionHostRuntimeBackendIdsByPolicy({
    entries: listExtensionHostTtsRuntimeBackendCatalogEntries(),
    subsystemId: "tts",
    include: (entry) => isConfiguredTtsRuntimeBackend(config, entry),
    fallbackBackendId: "edge",
  })[0] ?? "edge") as TtsProvider;
}

export function resolveExtensionHostTtsFallbackProviders(params: {
  config: ResolvedTtsConfig;
  preferredProvider: TtsProvider;
}): readonly TtsProvider[] {
  return resolveExtensionHostRuntimeBackendIdsByPolicy({
    entries: listExtensionHostTtsRuntimeBackendCatalogEntries(),
    subsystemId: "tts",
    preferredBackendId: params.preferredProvider,
    include: (entry) => isConfiguredTtsRuntimeBackend(params.config, entry),
  }).map((backendId) => backendId as TtsProvider);
}
