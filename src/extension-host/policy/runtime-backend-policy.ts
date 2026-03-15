import {
  resolveExtensionHostDefaultRuntimeBackendIdByArbitration,
  resolveExtensionHostRuntimeBackendFallbackChainByArbitration,
} from "./runtime-backend-arbitration.js";
import type {
  ExtensionHostRuntimeBackendCatalogEntry,
  ExtensionHostRuntimeBackendSubsystemId,
} from "./runtime-backend-catalog.js";

type ExtensionHostRuntimeBackendPolicyPredicate = (
  entry: ExtensionHostRuntimeBackendCatalogEntry,
) => boolean;

export function resolveExtensionHostRuntimeBackendIdsByPolicy(params: {
  entries: readonly ExtensionHostRuntimeBackendCatalogEntry[];
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  preferredBackendId?: string;
  include?: ExtensionHostRuntimeBackendPolicyPredicate;
  fallbackBackendId?: string;
}): readonly string[] {
  const preferredBackendId = params.preferredBackendId?.trim();
  if (preferredBackendId) {
    return resolveExtensionHostRuntimeBackendFallbackChainByArbitration({
      entries: params.entries,
      subsystemId: params.subsystemId,
      preferredBackendId,
      include: params.include,
    });
  }

  const defaultBackendId = resolveExtensionHostDefaultRuntimeBackendIdByArbitration({
    entries: params.entries,
    subsystemId: params.subsystemId,
    include: params.include,
    fallbackBackendId: params.fallbackBackendId,
  });
  if (!defaultBackendId) {
    return [];
  }

  return resolveExtensionHostRuntimeBackendFallbackChainByArbitration({
    entries: params.entries,
    subsystemId: params.subsystemId,
    preferredBackendId: defaultBackendId,
    include: params.include,
  });
}
