import type { OpenClawConfig } from "../../config/config.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import type { PluginRecord, PluginRegistry } from "../../plugins/registry.js";
import type { OpenClawPluginApi, OpenClawPluginModule, PluginLogger } from "../../plugins/types.js";
import { resolveExtensionHostActivationPolicy } from "../policy/loader-activation-policy.js";
import { recordExtensionHostPluginError } from "../policy/loader-policy.js";
import { importExtensionHostPluginModule } from "./loader-import.js";
import {
  planExtensionHostLoadedPlugin,
  runExtensionHostPluginRegister,
} from "./loader-register.js";
import { resolveExtensionHostModuleExport } from "./loader-runtime.js";
import {
  appendExtensionHostPluginRecord,
  setExtensionHostPluginRecordLifecycleState,
  setExtensionHostPluginRecordError,
} from "./loader-state.js";

export function processExtensionHostPluginCandidate(params: {
  candidate: PluginCandidate;
  manifestRecord: PluginManifestRecord;
  normalizedConfig: {
    entries: Record<
      string,
      {
        enabled?: boolean;
        hooks?: {
          allowPromptInjection?: boolean;
        };
        config?: unknown;
      }
    >;
    slots: {
      memory?: string | null;
    };
  };
  rootConfig: OpenClawConfig;
  validateOnly: boolean;
  logger: PluginLogger;
  registry: PluginRegistry;
  seenIds: Map<string, PluginRecord["origin"]>;
  selectedMemoryPluginId: string | null;
  createApi: (
    record: PluginRecord,
    options: {
      config: OpenClawConfig;
      pluginConfig?: Record<string, unknown>;
      hookPolicy?: { allowPromptInjection?: boolean };
    },
  ) => OpenClawPluginApi;
  loadModule: (safeSource: string) => OpenClawPluginModule;
}): { selectedMemoryPluginId: string | null; memorySlotMatched: boolean } {
  const { candidate, manifestRecord } = params;
  const activationPolicy = resolveExtensionHostActivationPolicy({
    candidate,
    manifestRecord,
    normalizedConfig: params.normalizedConfig,
    rootConfig: params.rootConfig,
    seenIds: params.seenIds,
    selectedMemoryPluginId: params.selectedMemoryPluginId,
  });
  if (activationPolicy.kind === "duplicate") {
    appendExtensionHostPluginRecord({
      registry: params.registry,
      record: activationPolicy.record,
    });
    return {
      selectedMemoryPluginId: params.selectedMemoryPluginId,
      memorySlotMatched: false,
    };
  }

  const { pluginId, record, entry } = activationPolicy;
  const pushPluginLoadError = (message: string) => {
    setExtensionHostPluginRecordError(record, message);
    appendExtensionHostPluginRecord({
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
    });
    params.registry.diagnostics.push({
      level: "error",
      pluginId: record.id,
      source: record.source,
      message: record.error,
    });
  };

  if (activationPolicy.kind === "disabled") {
    appendExtensionHostPluginRecord({
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
    });
    return {
      selectedMemoryPluginId: params.selectedMemoryPluginId,
      memorySlotMatched: false,
    };
  }

  if (!manifestRecord.configSchema) {
    pushPluginLoadError("missing config schema");
    return {
      selectedMemoryPluginId: params.selectedMemoryPluginId,
      memorySlotMatched: false,
    };
  }

  const moduleImport = importExtensionHostPluginModule({
    rootDir: candidate.rootDir,
    source: candidate.source,
    origin: candidate.origin,
    loadModule: params.loadModule,
  });
  if (!moduleImport.ok) {
    if (moduleImport.message !== "failed to load plugin") {
      pushPluginLoadError(moduleImport.message);
      return {
        selectedMemoryPluginId: params.selectedMemoryPluginId,
        memorySlotMatched: false,
      };
    }
    recordExtensionHostPluginError({
      logger: params.logger,
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
      error: moduleImport.error,
      logPrefix: `[plugins] ${record.id} failed to load from ${record.source}: `,
      diagnosticMessagePrefix: "failed to load plugin: ",
    });
    return {
      selectedMemoryPluginId: params.selectedMemoryPluginId,
      memorySlotMatched: false,
    };
  }

  setExtensionHostPluginRecordLifecycleState(record, "imported");
  const resolved = resolveExtensionHostModuleExport(moduleImport.module);
  const loadedPlan = planExtensionHostLoadedPlugin({
    record,
    manifestRecord,
    definition: resolved.definition,
    register: resolved.register,
    diagnostics: params.registry.diagnostics,
    memorySlot: params.normalizedConfig.slots.memory,
    selectedMemoryPluginId: params.selectedMemoryPluginId,
    entryConfig: entry?.config,
    validateOnly: params.validateOnly,
  });

  if (loadedPlan.kind === "error") {
    pushPluginLoadError(loadedPlan.message);
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  if (loadedPlan.kind === "disabled") {
    setExtensionHostPluginRecordDisabled(record, loadedPlan.reason);
    appendExtensionHostPluginRecord({
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
    });
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  if (loadedPlan.kind === "invalid-config") {
    params.logger.error(`[plugins] ${record.id} ${loadedPlan.message}`);
    pushPluginLoadError(loadedPlan.message);
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  setExtensionHostPluginRecordLifecycleState(record, "validated");
  if (loadedPlan.kind === "validate-only") {
    appendExtensionHostPluginRecord({
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
    });
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  if (loadedPlan.kind === "missing-register") {
    params.logger.error(`[plugins] ${record.id} missing register/activate export`);
    pushPluginLoadError(loadedPlan.message);
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  const registerResult = runExtensionHostPluginRegister({
    register: loadedPlan.register,
    createApi: params.createApi,
    record,
    config: params.rootConfig,
    pluginConfig: loadedPlan.pluginConfig,
    hookPolicy: entry?.hooks,
    diagnostics: params.registry.diagnostics,
  });
  if (!registerResult.ok) {
    recordExtensionHostPluginError({
      logger: params.logger,
      registry: params.registry,
      record,
      seenIds: params.seenIds,
      pluginId,
      origin: candidate.origin,
      error: registerResult.error,
      logPrefix: `[plugins] ${record.id} failed during register from ${record.source}: `,
      diagnosticMessagePrefix: "plugin failed during register: ",
    });
    return {
      selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
      memorySlotMatched: loadedPlan.memorySlotMatched,
    };
  }

  setExtensionHostPluginRecordLifecycleState(record, "registered");
  appendExtensionHostPluginRecord({
    registry: params.registry,
    record,
    seenIds: params.seenIds,
    pluginId,
    origin: candidate.origin,
  });
  return {
    selectedMemoryPluginId: loadedPlan.selectedMemoryPluginId,
    memorySlotMatched: loadedPlan.memorySlotMatched,
  };
}
