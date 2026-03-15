import type { PluginRegistry } from "../../plugins/registry.js";
import type { PluginLogger } from "../../plugins/types.js";
import { resolveExtensionHostFinalizationPolicy } from "../policy/loader-finalization-policy.js";
import type { ExtensionHostProvenanceIndex } from "../policy/loader-policy.js";
import { markExtensionHostRegistryPluginsReady } from "./loader-state.js";

export function finalizeExtensionHostRegistryLoad(params: {
  registry: PluginRegistry;
  memorySlot?: string | null;
  memorySlotMatched: boolean;
  provenance: ExtensionHostProvenanceIndex;
  logger: PluginLogger;
  env: NodeJS.ProcessEnv;
  cacheEnabled: boolean;
  cacheKey: string;
  setCachedRegistry: (cacheKey: string, registry: PluginRegistry) => void;
  activateRegistry: (registry: PluginRegistry, cacheKey: string) => void;
}): PluginRegistry {
  const finalizationPolicy = resolveExtensionHostFinalizationPolicy({
    registry: params.registry,
    memorySlot: params.memorySlot,
    memorySlotMatched: params.memorySlotMatched,
    provenance: params.provenance,
    env: params.env,
  });
  params.registry.diagnostics.push(...finalizationPolicy.diagnostics);
  for (const warning of finalizationPolicy.warningMessages) {
    params.logger.warn(warning);
  }

  if (params.cacheEnabled) {
    params.setCachedRegistry(params.cacheKey, params.registry);
  }
  markExtensionHostRegistryPluginsReady(params.registry);
  params.activateRegistry(params.registry, params.cacheKey);
  return params.registry;
}
