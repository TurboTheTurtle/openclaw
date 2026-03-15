import type { OpenClawConfig } from "../../config/config.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginRecord, PluginRegistry } from "../../plugins/registry.js";
import type { PluginDiagnostic, PluginLogger } from "../../plugins/types.js";
import {
  appendExtensionHostPluginRecord,
  setExtensionHostPluginRecordLifecycleState,
} from "../activation/loader-state.js";
import {
  addExtensionHostPathToMatcher,
  createExtensionHostPathMatcher,
  matchesExplicitExtensionHostInstallRule,
  type ExtensionHostInstallTrackingRule,
  type ExtensionHostProvenanceIndex,
} from "./loader-provenance.js";

export function createExtensionHostPluginRecord(params: {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  source: string;
  origin: PluginRecord["origin"];
  workspaceDir?: string;
  enabled: boolean;
  configSchema: boolean;
}): PluginRecord {
  const record: PluginRecord = {
    id: params.id,
    name: params.name ?? params.id,
    description: params.description,
    version: params.version,
    source: params.source,
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    enabled: params.enabled,
    status: params.enabled ? "loaded" : "disabled",
    toolNames: [],
    hookNames: [],
    channelIds: [],
    providerIds: [],
    gatewayMethods: [],
    cliCommands: [],
    services: [],
    commands: [],
    httpRoutes: 0,
    hookCount: 0,
    configSchema: params.configSchema,
    configUiHints: undefined,
    configJsonSchema: undefined,
  };
  return setExtensionHostPluginRecordLifecycleState(
    record,
    params.enabled ? "prepared" : "disabled",
  );
}

export function recordExtensionHostPluginError(params: {
  logger: PluginLogger;
  registry: PluginRegistry;
  record: PluginRecord;
  seenIds: Map<string, PluginRecord["origin"]>;
  pluginId: string;
  origin: PluginRecord["origin"];
  error: unknown;
  logPrefix: string;
  diagnosticMessagePrefix: string;
}): void {
  const errorText = String(params.error);
  const deprecatedApiHint =
    errorText.includes("api.registerHttpHandler") && errorText.includes("is not a function")
      ? "deprecated api.registerHttpHandler(...) was removed; use api.registerHttpRoute(...) for plugin-owned routes or registerPluginHttpRoute(...) for dynamic lifecycle routes"
      : null;
  const displayError = deprecatedApiHint ? `${deprecatedApiHint} (${errorText})` : errorText;
  params.logger.error(`${params.logPrefix}${displayError}`);
  setExtensionHostPluginRecordLifecycleState(params.record, "error", { error: displayError });
  appendExtensionHostPluginRecord({
    registry: params.registry,
    record: params.record,
    seenIds: params.seenIds,
    pluginId: params.pluginId,
    origin: params.origin,
  });
  params.registry.diagnostics.push({
    level: "error",
    pluginId: params.record.id,
    source: params.record.source,
    message: `${params.diagnosticMessagePrefix}${displayError}`,
  });
}

export function pushExtensionHostDiagnostics(
  diagnostics: PluginDiagnostic[],
  append: PluginDiagnostic[],
): void {
  diagnostics.push(...append);
}

export function buildExtensionHostProvenanceIndex(params: {
  config: OpenClawConfig;
  normalizedLoadPaths: string[];
  env: NodeJS.ProcessEnv;
}): ExtensionHostProvenanceIndex {
  const loadPathMatcher = createExtensionHostPathMatcher();
  for (const loadPath of params.normalizedLoadPaths) {
    addExtensionHostPathToMatcher(loadPathMatcher, loadPath, params.env);
  }

  const installRules = new Map<string, ExtensionHostInstallTrackingRule>();
  const installs = params.config.plugins?.installs ?? {};
  for (const [pluginId, install] of Object.entries(installs)) {
    const rule: ExtensionHostInstallTrackingRule = {
      trackedWithoutPaths: false,
      matcher: createExtensionHostPathMatcher(),
    };
    const trackedPaths = [install.installPath, install.sourcePath]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    if (trackedPaths.length === 0) {
      rule.trackedWithoutPaths = true;
    } else {
      for (const trackedPath of trackedPaths) {
        addExtensionHostPathToMatcher(rule.matcher, trackedPath, params.env);
      }
    }
    installRules.set(pluginId, rule);
  }

  return { loadPathMatcher, installRules };
}

function resolveCandidateDuplicateRank(params: {
  candidate: PluginCandidate;
  manifestByRoot: Map<string, { id: string }>;
  provenance: ExtensionHostProvenanceIndex;
  env: NodeJS.ProcessEnv;
}): number {
  const manifestRecord = params.manifestByRoot.get(params.candidate.rootDir);
  const pluginId = manifestRecord?.id;
  const isExplicitInstall =
    params.candidate.origin === "global" &&
    pluginId !== undefined &&
    matchesExplicitExtensionHostInstallRule({
      pluginId,
      source: params.candidate.source,
      index: params.provenance,
      env: params.env,
    });

  switch (params.candidate.origin) {
    case "config":
      return 0;
    case "workspace":
      return 1;
    case "global":
      return isExplicitInstall ? 2 : 4;
    case "bundled":
      return 3;
  }
}

export function compareExtensionHostDuplicateCandidateOrder(params: {
  left: PluginCandidate;
  right: PluginCandidate;
  manifestByRoot: Map<string, { id: string }>;
  provenance: ExtensionHostProvenanceIndex;
  env: NodeJS.ProcessEnv;
}): number {
  const leftPluginId = params.manifestByRoot.get(params.left.rootDir)?.id;
  const rightPluginId = params.manifestByRoot.get(params.right.rootDir)?.id;
  if (!leftPluginId || leftPluginId !== rightPluginId) {
    return 0;
  }
  return (
    resolveCandidateDuplicateRank({
      candidate: params.left,
      manifestByRoot: params.manifestByRoot,
      provenance: params.provenance,
      env: params.env,
    }) -
    resolveCandidateDuplicateRank({
      candidate: params.right,
      manifestByRoot: params.manifestByRoot,
      provenance: params.provenance,
      env: params.env,
    })
  );
}
