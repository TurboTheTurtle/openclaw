import type { MediaUnderstandingProvider } from "../media-understanding/types.js";
import {
  listExtensionHostMediaUnderstandingProviders,
  normalizeExtensionHostMediaProviderId,
} from "./media-runtime-backends.js";

export type ExtensionHostMediaUnderstandingProviderRegistry = Map<
  string,
  MediaUnderstandingProvider
>;

export { normalizeExtensionHostMediaProviderId } from "./media-runtime-backends.js";

export function buildExtensionHostMediaUnderstandingRegistry(
  overrides?: Record<string, MediaUnderstandingProvider>,
): ExtensionHostMediaUnderstandingProviderRegistry {
  const registry: ExtensionHostMediaUnderstandingProviderRegistry = new Map();
  for (const provider of listExtensionHostMediaUnderstandingProviders()) {
    registry.set(normalizeExtensionHostMediaProviderId(provider.id), provider);
  }
  if (!overrides) {
    return registry;
  }

  for (const [key, provider] of Object.entries(overrides)) {
    const normalizedKey = normalizeExtensionHostMediaProviderId(key);
    const existing = registry.get(normalizedKey);
    const merged = existing
      ? {
          ...existing,
          ...provider,
          capabilities: provider.capabilities ?? existing.capabilities,
        }
      : provider;
    registry.set(normalizedKey, merged);
  }
  return registry;
}

export function getExtensionHostMediaUnderstandingProvider(
  id: string,
  registry: ExtensionHostMediaUnderstandingProviderRegistry,
): MediaUnderstandingProvider | undefined {
  return registry.get(normalizeExtensionHostMediaProviderId(id));
}
