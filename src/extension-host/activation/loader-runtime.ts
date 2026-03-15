import { resolveMemorySlotDecision } from "../../plugins/config-state.js";
import type { PluginRecord } from "../../plugins/registry.js";
import { validateJsonSchemaValue } from "../../plugins/schema-validator.js";
import type { OpenClawPluginDefinition, PluginDiagnostic } from "../../plugins/types.js";

export function validateExtensionHostConfig(params: {
  schema?: Record<string, unknown>;
  cacheKey?: string;
  value?: unknown;
}): { ok: boolean; value?: Record<string, unknown>; errors?: string[] } {
  const schema = params.schema;
  if (!schema) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }
  const cacheKey = params.cacheKey ?? JSON.stringify(schema);
  const result = validateJsonSchemaValue({
    schema,
    cacheKey,
    value: params.value ?? {},
  });
  if (result.ok) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }
  return { ok: false, errors: result.errors.map((error) => error.text) };
}

export function resolveExtensionHostModuleExport(moduleExport: unknown): {
  definition?: OpenClawPluginDefinition;
  register?: OpenClawPluginDefinition["register"];
} {
  const resolved =
    moduleExport &&
    typeof moduleExport === "object" &&
    "default" in (moduleExport as Record<string, unknown>)
      ? (moduleExport as { default: unknown }).default
      : moduleExport;
  if (typeof resolved === "function") {
    return {
      register: resolved as OpenClawPluginDefinition["register"],
    };
  }
  if (resolved && typeof resolved === "object") {
    const def = resolved as OpenClawPluginDefinition;
    const register = def.register ?? def.activate;
    return { definition: def, register };
  }
  return {};
}

export function applyExtensionHostDefinitionToRecord(params: {
  record: PluginRecord;
  definition?: OpenClawPluginDefinition;
  diagnostics: PluginDiagnostic[];
}):
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    } {
  if (params.definition?.id && params.definition.id !== params.record.id) {
    return {
      ok: false,
      message: `plugin id mismatch (config uses "${params.record.id}", export uses "${params.definition.id}")`,
    };
  }

  params.record.name = params.definition?.name ?? params.record.name;
  params.record.description = params.definition?.description ?? params.record.description;
  params.record.version = params.definition?.version ?? params.record.version;
  const manifestKind = params.record.kind as string | undefined;
  const exportKind = params.definition?.kind as string | undefined;
  if (manifestKind && exportKind && exportKind !== manifestKind) {
    params.diagnostics.push({
      level: "warn",
      pluginId: params.record.id,
      source: params.record.source,
      message: `plugin kind mismatch (manifest uses "${manifestKind}", export uses "${exportKind}")`,
    });
  }
  params.record.kind = params.definition?.kind ?? params.record.kind;
  return { ok: true };
}

export function resolveExtensionHostEarlyMemoryDecision(params: {
  origin: PluginRecord["origin"];
  manifestKind?: PluginRecord["kind"];
  recordId: string;
  memorySlot?: string;
  selectedMemoryPluginId: string | null;
}): { enabled: boolean; reason?: string } {
  if (params.origin !== "bundled" || params.manifestKind !== "memory") {
    return { enabled: true };
  }
  const decision = resolveMemorySlotDecision({
    id: params.recordId,
    kind: "memory",
    slot: params.memorySlot,
    selectedId: params.selectedMemoryPluginId,
  });
  return {
    enabled: decision.enabled,
    ...(decision.enabled ? {} : { reason: decision.reason }),
  };
}

export function resolveExtensionHostMemoryDecision(params: {
  recordId: string;
  recordKind?: PluginRecord["kind"];
  memorySlot?: string;
  selectedMemoryPluginId: string | null;
}): { enabled: boolean; selected: boolean; reason?: string } {
  const decision = resolveMemorySlotDecision({
    id: params.recordId,
    kind: params.recordKind,
    slot: params.memorySlot,
    selectedId: params.selectedMemoryPluginId,
  });
  return {
    enabled: decision.enabled,
    selected: decision.selected,
    ...(decision.enabled ? {} : { reason: decision.reason }),
  };
}
