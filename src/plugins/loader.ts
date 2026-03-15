import {
  clearExtensionHostLoaderState,
  type ExtensionHostPluginLoadOptions,
  loadExtensionHostPluginRegistry,
  MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES,
} from "../extension-host/activation/loader-orchestrator.js";
import {
  listPluginSdkAliasCandidates,
  listPluginSdkExportedSubpaths,
  resolvePluginSdkAliasCandidateOrder,
  resolvePluginSdkAliasFile,
} from "../extension-host/compat/loader-compat.js";
import type { PluginRegistry } from "./registry.js";

export type PluginLoadResult = PluginRegistry;

export type PluginLoadOptions = ExtensionHostPluginLoadOptions;

export function clearPluginLoaderCache(): void {
  clearExtensionHostLoaderState();
}

export const __testing = {
  listPluginSdkAliasCandidates,
  listPluginSdkExportedSubpaths,
  resolvePluginSdkAliasCandidateOrder,
  resolvePluginSdkAliasFile,
  maxPluginRegistryCacheEntries: MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES,
};

export function loadOpenClawPlugins(options: PluginLoadOptions = {}): PluginRegistry {
  return loadExtensionHostPluginRegistry(options);
}
