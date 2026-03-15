import type { PluginRegistry } from "../../plugins/registry.js";
import type { PluginDiagnostic } from "../../plugins/types.js";
import {
  isExtensionHostTrackedByProvenance,
  safeRealpathOrResolveExtensionHostPath,
  type ExtensionHostProvenanceIndex,
} from "./loader-provenance.js";

export function resolveExtensionHostFinalizationPolicy(params: {
  registry: PluginRegistry;
  memorySlot?: string | null;
  memorySlotMatched: boolean;
  provenance: ExtensionHostProvenanceIndex;
  env: NodeJS.ProcessEnv;
}): {
  diagnostics: PluginDiagnostic[];
  warningMessages: string[];
} {
  const diagnostics: PluginDiagnostic[] = [];
  const warningMessages: string[] = [];

  if (typeof params.memorySlot === "string" && !params.memorySlotMatched) {
    diagnostics.push({
      level: "warn",
      message: `memory slot plugin not found or not marked as memory: ${params.memorySlot}`,
    });
  }

  for (const plugin of params.registry.plugins) {
    if (plugin.status !== "loaded" || plugin.origin === "bundled") {
      continue;
    }
    if (
      isExtensionHostTrackedByProvenance({
        pluginId: plugin.id,
        source: plugin.source,
        index: params.provenance,
        env: params.env,
      })
    ) {
      continue;
    }
    const message =
      "loaded without install/load-path provenance; treat as untracked local code and pin trust via plugins.allow or install records";
    diagnostics.push({
      level: "warn",
      pluginId: plugin.id,
      source: plugin.source,
      message,
    });
    warningMessages.push(
      `[plugins] ${plugin.id}: ${message} (${safeRealpathOrResolveExtensionHostPath(plugin.source)})`,
    );
  }

  return { diagnostics, warningMessages };
}
