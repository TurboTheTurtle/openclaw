import type { OpenClawConfig } from "../../config/config.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import type {
  OpenClawPluginApi,
  OpenClawPluginDefinition,
  OpenClawPluginHookOptions,
  PluginDiagnostic,
} from "../../plugins/types.js";
import {
  applyExtensionHostDefinitionToRecord,
  resolveExtensionHostMemoryDecision,
  validateExtensionHostConfig,
} from "./loader-runtime.js";

export type ExtensionHostLoadedPluginPlan =
  | {
      kind: "disabled";
      reason?: string;
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    }
  | {
      kind: "invalid-config";
      message: string;
      errors: string[];
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    }
  | {
      kind: "validate-only";
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    }
  | {
      kind: "missing-register";
      message: string;
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    }
  | {
      kind: "register";
      register: NonNullable<OpenClawPluginDefinition["register"]>;
      pluginConfig?: Record<string, unknown>;
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    }
  | {
      kind: "error";
      message: string;
      memorySlotMatched: boolean;
      selectedMemoryPluginId: string | null;
    };

export function planExtensionHostLoadedPlugin(params: {
  record: PluginRecord;
  manifestRecord: Pick<PluginManifestRecord, "configSchema" | "schemaCacheKey">;
  definition?: OpenClawPluginDefinition;
  register?: OpenClawPluginDefinition["register"];
  diagnostics: PluginDiagnostic[];
  memorySlot?: string | null;
  selectedMemoryPluginId: string | null;
  entryConfig?: unknown;
  validateOnly: boolean;
}): ExtensionHostLoadedPluginPlan {
  const definitionResult = applyExtensionHostDefinitionToRecord({
    record: params.record,
    definition: params.definition,
    diagnostics: params.diagnostics,
  });
  const memorySlotMatched =
    params.record.kind === "memory" && params.memorySlot === params.record.id;
  if (!definitionResult.ok) {
    return {
      kind: "error",
      message: definitionResult.message,
      memorySlotMatched,
      selectedMemoryPluginId: params.selectedMemoryPluginId,
    };
  }

  const memoryDecision = resolveExtensionHostMemoryDecision({
    recordId: params.record.id,
    recordKind: params.record.kind,
    memorySlot: params.memorySlot,
    selectedMemoryPluginId: params.selectedMemoryPluginId,
  });
  const nextSelectedMemoryPluginId =
    memoryDecision.selected && params.record.kind === "memory"
      ? params.record.id
      : params.selectedMemoryPluginId;

  if (!memoryDecision.enabled) {
    return {
      kind: "disabled",
      reason: memoryDecision.reason,
      memorySlotMatched,
      selectedMemoryPluginId: nextSelectedMemoryPluginId,
    };
  }

  const validatedConfig = validateExtensionHostConfig({
    schema: params.manifestRecord.configSchema,
    cacheKey: params.manifestRecord.schemaCacheKey,
    value: params.entryConfig,
  });
  if (!validatedConfig.ok) {
    return {
      kind: "invalid-config",
      message: `invalid config: ${validatedConfig.errors.join(", ")}`,
      errors: validatedConfig.errors,
      memorySlotMatched,
      selectedMemoryPluginId: nextSelectedMemoryPluginId,
    };
  }

  if (params.validateOnly) {
    return {
      kind: "validate-only",
      memorySlotMatched,
      selectedMemoryPluginId: nextSelectedMemoryPluginId,
    };
  }

  if (typeof params.register !== "function") {
    return {
      kind: "missing-register",
      message: "plugin export missing register/activate",
      memorySlotMatched,
      selectedMemoryPluginId: nextSelectedMemoryPluginId,
    };
  }

  return {
    kind: "register",
    register: params.register,
    pluginConfig: validatedConfig.value,
    memorySlotMatched,
    selectedMemoryPluginId: nextSelectedMemoryPluginId,
  };
}

export function runExtensionHostPluginRegister(params: {
  register: NonNullable<OpenClawPluginDefinition["register"]>;
  createApi: (
    record: PluginRecord,
    options: {
      config: OpenClawConfig;
      pluginConfig?: Record<string, unknown>;
      hookPolicy?: OpenClawPluginHookOptions;
    },
  ) => OpenClawPluginApi;
  record: PluginRecord;
  config: OpenClawConfig;
  pluginConfig?: Record<string, unknown>;
  hookPolicy?: OpenClawPluginHookOptions;
  diagnostics: PluginDiagnostic[];
}):
  | {
      ok: true;
    }
  | {
      ok: false;
      error: unknown;
    } {
  try {
    const result = params.register(
      params.createApi(params.record, {
        config: params.config,
        pluginConfig: params.pluginConfig,
        hookPolicy: params.hookPolicy,
      }),
    );
    if (result && typeof result === "object" && "then" in result) {
      params.diagnostics.push({
        level: "warn",
        pluginId: params.record.id,
        source: params.record.source,
        message: "plugin register returned a promise; async registration is ignored",
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
