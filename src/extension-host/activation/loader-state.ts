import type {
  PluginRecord,
  PluginRecordLifecycleState,
  PluginRegistry,
} from "../../plugins/registry.js";

const EXTENSION_HOST_LIFECYCLE_STATUS_MAP: Record<
  PluginRecordLifecycleState,
  PluginRecord["status"]
> = {
  prepared: "loaded",
  imported: "loaded",
  disabled: "disabled",
  validated: "loaded",
  registered: "loaded",
  ready: "loaded",
  error: "error",
};

const EXTENSION_HOST_PLUGIN_LIFECYCLE_TRANSITIONS: Record<
  PluginRecordLifecycleState,
  Set<PluginRecordLifecycleState>
> = {
  prepared: new Set(["imported", "disabled", "error"]),
  imported: new Set(["validated", "disabled", "error"]),
  disabled: new Set(),
  validated: new Set(["registered", "disabled", "error"]),
  registered: new Set(["ready", "error"]),
  ready: new Set(["error"]),
  error: new Set(),
};

function assertExtensionHostPluginLifecycleTransition(
  currentState: PluginRecordLifecycleState | undefined,
  nextState: PluginRecordLifecycleState,
): void {
  if (currentState === undefined) {
    if (nextState === "prepared" || nextState === "disabled" || nextState === "error") {
      return;
    }
    throw new Error(`invalid initial extension host lifecycle transition: <none> -> ${nextState}`);
  }
  if (currentState === nextState) {
    return;
  }
  if (EXTENSION_HOST_PLUGIN_LIFECYCLE_TRANSITIONS[currentState].has(nextState)) {
    return;
  }
  throw new Error(`invalid extension host lifecycle transition: ${currentState} -> ${nextState}`);
}

export function setExtensionHostPluginRecordLifecycleState(
  record: PluginRecord,
  nextState: PluginRecordLifecycleState,
  opts?: { error?: string },
): PluginRecord {
  assertExtensionHostPluginLifecycleTransition(record.lifecycleState, nextState);
  record.lifecycleState = nextState;
  record.status = EXTENSION_HOST_LIFECYCLE_STATUS_MAP[nextState];

  if (nextState === "disabled") {
    record.enabled = false;
    record.error = opts?.error;
    return record;
  }
  if (nextState === "error") {
    record.error = opts?.error;
    return record;
  }
  if (opts?.error === undefined) {
    delete record.error;
  }
  return record;
}

export function setExtensionHostPluginRecordDisabled(
  record: PluginRecord,
  reason?: string,
): PluginRecord {
  return setExtensionHostPluginRecordLifecycleState(record, "disabled", { error: reason });
}

export function setExtensionHostPluginRecordError(
  record: PluginRecord,
  message: string,
): PluginRecord {
  return setExtensionHostPluginRecordLifecycleState(record, "error", { error: message });
}

export function markExtensionHostRegistryPluginsReady(registry: PluginRegistry): void {
  for (const record of registry.plugins) {
    if (record.lifecycleState === "registered") {
      setExtensionHostPluginRecordLifecycleState(record, "ready");
    }
  }
}

export function appendExtensionHostPluginRecord(params: {
  registry: PluginRegistry;
  record: PluginRecord;
  seenIds?: Map<string, PluginRecord["origin"]>;
  pluginId?: string;
  origin?: PluginRecord["origin"];
}): void {
  params.registry.plugins.push(params.record);
  if (params.seenIds && params.pluginId && params.origin) {
    params.seenIds.set(params.pluginId, params.origin);
  }
}
