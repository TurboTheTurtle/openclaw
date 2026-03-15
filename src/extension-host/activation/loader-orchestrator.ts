import type { OpenClawConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import {
  createPluginRuntime,
  type CreatePluginRuntimeOptions,
} from "../../plugins/runtime/index.js";
import type { PluginLogger } from "../../plugins/types.js";
import { clearExtensionHostPluginCommands } from "./command-runtime.js";
import {
  clearExtensionHostLoaderHostState,
  getExtensionHostDiscoveryWarningCache,
} from "./loader-host-state.js";
import { executeExtensionHostLoaderPipeline } from "./loader-pipeline.js";
import { prepareExtensionHostLoaderPreflight } from "./loader-preflight.js";

export type ExtensionHostPluginLoadOptions = {
  config?: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  logger?: PluginLogger;
  coreGatewayHandlers?: Record<
    string,
    import("../../gateway/server-methods/types.js").GatewayRequestHandler
  >;
  runtimeOptions?: CreatePluginRuntimeOptions;
  cache?: boolean;
  mode?: "full" | "validate";
};

const defaultLogger = () => createSubsystemLogger("plugins");

export function clearExtensionHostLoaderState(): void {
  clearExtensionHostLoaderHostState();
}

export function loadExtensionHostPluginRegistry(
  options: ExtensionHostPluginLoadOptions = {},
): PluginRegistry {
  const preflight = prepareExtensionHostLoaderPreflight({
    options,
    createDefaultLogger: defaultLogger,
    clearPluginCommands: clearExtensionHostPluginCommands,
  });
  if (preflight.cacheHit) {
    return preflight.registry;
  }

  return executeExtensionHostLoaderPipeline({
    preflight,
    workspaceDir: options.workspaceDir,
    cache: options.cache,
    coreGatewayHandlers: options.coreGatewayHandlers,
    runtimeOptions: options.runtimeOptions,
    warningCache: getExtensionHostDiscoveryWarningCache(),
    createRuntime: createPluginRuntime,
  });
}
