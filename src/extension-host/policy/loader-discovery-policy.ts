import type { PluginRecord } from "../../plugins/registry.js";

export function resolveExtensionHostDiscoveryPolicy(params: {
  pluginsEnabled: boolean;
  allow: string[];
  warningCacheKey: string;
  warningCache: Set<string>;
  discoverablePlugins: Array<{ id: string; source: string; origin: PluginRecord["origin"] }>;
}): {
  warningMessages: string[];
} {
  if (!params.pluginsEnabled || params.allow.length > 0) {
    return { warningMessages: [] };
  }

  const nonBundled = params.discoverablePlugins.filter((entry) => entry.origin !== "bundled");
  if (nonBundled.length === 0 || params.warningCache.has(params.warningCacheKey)) {
    return { warningMessages: [] };
  }

  const preview = nonBundled
    .slice(0, 6)
    .map((entry) => `${entry.id} (${entry.source})`)
    .join(", ");
  const extra = nonBundled.length > 6 ? ` (+${nonBundled.length - 6} more)` : "";
  params.warningCache.add(params.warningCacheKey);

  return {
    warningMessages: [
      `[plugins] plugins.allow is empty; discovered non-bundled plugins may auto-load: ${preview}${extra}. Set plugins.allow to explicit trusted ids.`,
    ],
  };
}
