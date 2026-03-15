import type {
  ExtensionHostRuntimeBackendCatalogEntry,
  ExtensionHostRuntimeBackendSubsystemId,
} from "./runtime-backend-catalog.js";

type ExtensionHostRuntimeBackendArbitrationPredicate = (
  entry: ExtensionHostRuntimeBackendCatalogEntry,
) => boolean;

export function listExtensionHostRuntimeBackendCandidatesByArbitration(params: {
  entries: readonly ExtensionHostRuntimeBackendCatalogEntry[];
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  include?: ExtensionHostRuntimeBackendArbitrationPredicate;
}): readonly ExtensionHostRuntimeBackendCatalogEntry[] {
  const include = params.include ?? (() => true);
  return params.entries
    .filter((entry) => entry.subsystemId === params.subsystemId && include(entry))
    .toSorted((left, right) => left.defaultRank - right.defaultRank);
}

export function listExtensionHostRuntimeBackendIdsByArbitration(params: {
  entries: readonly ExtensionHostRuntimeBackendCatalogEntry[];
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  include?: ExtensionHostRuntimeBackendArbitrationPredicate;
}): readonly string[] {
  return listExtensionHostRuntimeBackendCandidatesByArbitration(params).map(
    (entry) => entry.backendId,
  );
}

export function resolveExtensionHostRuntimeBackendOrderByArbitration(params: {
  entries: readonly ExtensionHostRuntimeBackendCatalogEntry[];
  subsystemId: ExtensionHostRuntimeBackendSubsystemId;
  preferredBackendId: string;
  include?: ExtensionHostRuntimeBackendArbitrationPredicate;
}): readonly string[] {
  const ordered = listExtensionHostRuntimeBackendIdsByArbitration(params);
  if (!ordered.includes(params.preferredBackendId)) {
    return [params.preferredBackendId, ...ordered];
  }
  return [
    params.preferredBackendId,
    ...ordered.filter((backendId) => backendId !== params.preferredBackendId),
  ];
}
