import type { PluginInstallRecord } from "../../config/types.plugins.js";
import type { NormalizedPluginsConfig } from "../../plugins/config-state.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import { resolvePluginCacheInputs } from "../../plugins/roots.js";
import { resolveUserPath } from "../../utils.js";

export const MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES = 32;

const extensionHostRegistryCache = new Map<string, PluginRegistry>();

export function clearExtensionHostRegistryCache(): void {
  extensionHostRegistryCache.clear();
}

export function getCachedExtensionHostRegistry(cacheKey: string): PluginRegistry | undefined {
  const cached = extensionHostRegistryCache.get(cacheKey);
  if (!cached) {
    return undefined;
  }
  // Refresh insertion order so frequently reused registries survive eviction.
  extensionHostRegistryCache.delete(cacheKey);
  extensionHostRegistryCache.set(cacheKey, cached);
  return cached;
}

export function setCachedExtensionHostRegistry(cacheKey: string, registry: PluginRegistry): void {
  if (extensionHostRegistryCache.has(cacheKey)) {
    extensionHostRegistryCache.delete(cacheKey);
  }
  extensionHostRegistryCache.set(cacheKey, registry);
  while (extensionHostRegistryCache.size > MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES) {
    const oldestKey = extensionHostRegistryCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    extensionHostRegistryCache.delete(oldestKey);
  }
}

export function buildExtensionHostRegistryCacheKey(params: {
  workspaceDir?: string;
  plugins: NormalizedPluginsConfig;
  installs?: Record<string, PluginInstallRecord>;
  env: NodeJS.ProcessEnv;
}): string {
  const { roots, loadPaths } = resolvePluginCacheInputs({
    workspaceDir: params.workspaceDir,
    loadPaths: params.plugins.loadPaths,
    env: params.env,
  });
  const installs = Object.fromEntries(
    Object.entries(params.installs ?? {}).map(([pluginId, install]) => [
      pluginId,
      {
        ...install,
        installPath:
          typeof install.installPath === "string"
            ? resolveUserPath(install.installPath, params.env)
            : install.installPath,
        sourcePath:
          typeof install.sourcePath === "string"
            ? resolveUserPath(install.sourcePath, params.env)
            : install.sourcePath,
      },
    ]),
  );
  return `${roots.workspace ?? ""}::${roots.global ?? ""}::${roots.stock ?? ""}::${JSON.stringify({
    ...params.plugins,
    installs,
    loadPaths,
  })}`;
}
