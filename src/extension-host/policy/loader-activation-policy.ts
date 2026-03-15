import type { OpenClawConfig } from "../../config/config.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import { prepareExtensionHostPluginCandidate } from "../activation/loader-records.js";
import { resolveExtensionHostEarlyMemoryDecision } from "../activation/loader-runtime.js";
import { setExtensionHostPluginRecordDisabled } from "../activation/loader-state.js";

export type ExtensionHostActivationPolicyOutcome =
  | {
      kind: "duplicate";
      pluginId: string;
      record: PluginRecord;
    }
  | {
      kind: "disabled";
      pluginId: string;
      record: PluginRecord;
      entry:
        | {
            enabled?: boolean;
            hooks?: {
              allowPromptInjection?: boolean;
            };
            config?: unknown;
          }
        | undefined;
      reason?: string;
    }
  | {
      kind: "candidate";
      pluginId: string;
      record: PluginRecord;
      entry:
        | {
            enabled?: boolean;
            hooks?: {
              allowPromptInjection?: boolean;
            };
            config?: unknown;
          }
        | undefined;
    };

export function resolveExtensionHostActivationPolicy(params: {
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
  seenIds: Map<string, PluginRecord["origin"]>;
  selectedMemoryPluginId: string | null;
}): ExtensionHostActivationPolicyOutcome {
  const preparedCandidate = prepareExtensionHostPluginCandidate({
    candidate: params.candidate,
    manifestRecord: params.manifestRecord,
    normalizedConfig: params.normalizedConfig,
    rootConfig: params.rootConfig,
    seenIds: params.seenIds,
  });
  if (preparedCandidate.kind === "duplicate") {
    return preparedCandidate;
  }

  const { pluginId, record, entry, enableState } = preparedCandidate;
  if (!enableState.enabled) {
    setExtensionHostPluginRecordDisabled(record, enableState.reason);
    return {
      kind: "disabled",
      pluginId,
      record,
      entry,
      reason: enableState.reason,
    };
  }

  const earlyMemoryDecision = resolveExtensionHostEarlyMemoryDecision({
    origin: params.candidate.origin,
    manifestKind: params.manifestRecord.kind,
    recordId: record.id,
    memorySlot: params.normalizedConfig.slots.memory,
    selectedMemoryPluginId: params.selectedMemoryPluginId,
  });
  if (!earlyMemoryDecision.enabled) {
    setExtensionHostPluginRecordDisabled(record, earlyMemoryDecision.reason);
    return {
      kind: "disabled",
      pluginId,
      record,
      entry,
      reason: earlyMemoryDecision.reason,
    };
  }

  return {
    kind: "candidate",
    pluginId,
    record,
    entry,
  };
}
