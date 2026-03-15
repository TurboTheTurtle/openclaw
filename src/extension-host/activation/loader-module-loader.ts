import { createJiti } from "jiti";
import type { OpenClawPluginModule } from "../../plugins/types.js";
import { resolvePluginSdkAlias, resolvePluginSdkScopedAliasMap } from "../compat/loader-compat.js";

type JitiLoaderFactory = typeof createJiti;
type JitiLoader = ReturnType<JitiLoaderFactory>;

export function createExtensionHostModuleLoader(
  params: {
    createJitiLoader?: JitiLoaderFactory;
    importMetaUrl?: string;
    resolvePluginSdkAliasFn?: typeof resolvePluginSdkAlias;
    resolvePluginSdkScopedAliasMapFn?: typeof resolvePluginSdkScopedAliasMap;
  } = {},
): (safeSource: string) => OpenClawPluginModule {
  const createJitiLoader = params.createJitiLoader ?? createJiti;
  const importMetaUrl = params.importMetaUrl ?? import.meta.url;
  const resolvePluginSdkAliasFn = params.resolvePluginSdkAliasFn ?? resolvePluginSdkAlias;
  const resolvePluginSdkScopedAliasMapFn =
    params.resolvePluginSdkScopedAliasMapFn ?? resolvePluginSdkScopedAliasMap;

  let jitiLoader: JitiLoader | null = null;

  const getJiti = (): JitiLoader => {
    if (jitiLoader) {
      return jitiLoader;
    }
    const pluginSdkAlias = resolvePluginSdkAliasFn();
    const aliasMap = {
      ...(pluginSdkAlias ? { "openclaw/plugin-sdk": pluginSdkAlias } : {}),
      ...resolvePluginSdkScopedAliasMapFn(),
    };
    jitiLoader = createJitiLoader(importMetaUrl, {
      interopDefault: true,
      extensions: [".ts", ".tsx", ".mts", ".cts", ".mtsx", ".ctsx", ".js", ".mjs", ".cjs", ".json"],
      ...(Object.keys(aliasMap).length > 0 ? { alias: aliasMap } : {}),
    });
    return jitiLoader;
  };

  return (safeSource: string): OpenClawPluginModule => {
    return getJiti()(safeSource) as OpenClawPluginModule;
  };
}
