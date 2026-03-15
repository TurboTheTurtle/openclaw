import { clearExtensionHostRegistryCache } from "./loader-cache.js";

const extensionHostDiscoveryWarningCache = new Set<string>();

export function getExtensionHostDiscoveryWarningCache(): Set<string> {
  return extensionHostDiscoveryWarningCache;
}

export function clearExtensionHostLoaderHostState(): void {
  clearExtensionHostRegistryCache();
  extensionHostDiscoveryWarningCache.clear();
}
