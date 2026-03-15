import type { OpenClawConfig } from "../../config/config.js";
import {
  resolveEffectiveEnableState,
  type NormalizedPluginsConfig,
} from "../../plugins/config-state.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import { createExtensionHostPluginRecord } from "../policy/loader-policy.js";
import { setExtensionHostPluginRecordDisabled } from "./loader-state.js";

type CandidateEntry = NormalizedPluginsConfig["entries"][string];

export type ExtensionHostPreparedPluginCandidate =
  | {
      kind: "duplicate";
      pluginId: string;
      record: PluginRecord;
    }
  | {
      kind: "candidate";
      pluginId: string;
      record: PluginRecord;
      entry: CandidateEntry | undefined;
      enableState: { enabled: boolean; reason?: string };
    };

export function prepareExtensionHostPluginCandidate(params: {
  candidate: PluginCandidate;
  manifestRecord: PluginManifestRecord;
  normalizedConfig: NormalizedPluginsConfig;
  rootConfig: OpenClawConfig;
  seenIds: Map<string, PluginRecord["origin"]>;
}): ExtensionHostPreparedPluginCandidate {
  const pluginId = params.manifestRecord.id;
  const existingOrigin = params.seenIds.get(pluginId);
  if (existingOrigin) {
    const record = createBasePluginRecord({
      candidate: params.candidate,
      manifestRecord: params.manifestRecord,
      enabled: false,
    });
    setExtensionHostPluginRecordDisabled(record, `overridden by ${existingOrigin} plugin`);
    return {
      kind: "duplicate",
      pluginId,
      record,
    };
  }

  const enableState = resolveEffectiveEnableState({
    id: pluginId,
    origin: params.candidate.origin,
    config: params.normalizedConfig,
    rootConfig: params.rootConfig,
  });
  const entry = params.normalizedConfig.entries[pluginId];
  const record = createBasePluginRecord({
    candidate: params.candidate,
    manifestRecord: params.manifestRecord,
    enabled: enableState.enabled,
  });
  return {
    kind: "candidate",
    pluginId,
    record,
    entry,
    enableState,
  };
}

function createBasePluginRecord(params: {
  candidate: PluginCandidate;
  manifestRecord: PluginManifestRecord;
  enabled: boolean;
}): PluginRecord {
  const pluginId = params.manifestRecord.id;
  const record = createExtensionHostPluginRecord({
    id: pluginId,
    name: params.manifestRecord.name ?? pluginId,
    description: params.manifestRecord.description,
    version: params.manifestRecord.version,
    source: params.candidate.source,
    origin: params.candidate.origin,
    workspaceDir: params.candidate.workspaceDir,
    enabled: params.enabled,
    configSchema: Boolean(params.manifestRecord.configSchema),
  });
  record.kind = params.manifestRecord.kind;
  record.configUiHints = params.manifestRecord.configUiHints;
  record.configJsonSchema = params.manifestRecord.configSchema;
  return record;
}
