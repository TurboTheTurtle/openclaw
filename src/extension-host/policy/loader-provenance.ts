import fs from "node:fs";
import path from "node:path";
import { isPathInside, safeStatSync } from "../../plugins/path-safety.js";
import { resolveUserPath } from "../../utils.js";

export type ExtensionHostPathMatcher = {
  exact: Set<string>;
  dirs: string[];
};

export type ExtensionHostInstallTrackingRule = {
  trackedWithoutPaths: boolean;
  matcher: ExtensionHostPathMatcher;
};

export type ExtensionHostProvenanceIndex = {
  loadPathMatcher: ExtensionHostPathMatcher;
  installRules: Map<string, ExtensionHostInstallTrackingRule>;
};

export function safeRealpathOrResolveExtensionHostPath(value: string): string {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

export function createExtensionHostPathMatcher(): ExtensionHostPathMatcher {
  return { exact: new Set<string>(), dirs: [] };
}

export function addExtensionHostPathToMatcher(
  matcher: ExtensionHostPathMatcher,
  rawPath: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return;
  }
  const resolved = resolveUserPath(trimmed, env);
  if (!resolved) {
    return;
  }
  if (matcher.exact.has(resolved) || matcher.dirs.includes(resolved)) {
    return;
  }
  const stat = safeStatSync(resolved);
  if (stat?.isDirectory()) {
    matcher.dirs.push(resolved);
    return;
  }
  matcher.exact.add(resolved);
}

export function matchesExtensionHostPathMatcher(
  matcher: ExtensionHostPathMatcher,
  sourcePath: string,
): boolean {
  if (matcher.exact.has(sourcePath)) {
    return true;
  }
  return matcher.dirs.some((dirPath) => isPathInside(dirPath, sourcePath));
}

export function isExtensionHostTrackedByProvenance(params: {
  pluginId: string;
  source: string;
  index: ExtensionHostProvenanceIndex;
  env: NodeJS.ProcessEnv;
}): boolean {
  const sourcePath = resolveUserPath(params.source, params.env);
  const installRule = params.index.installRules.get(params.pluginId);
  if (installRule) {
    if (installRule.trackedWithoutPaths) {
      return true;
    }
    if (matchesExtensionHostPathMatcher(installRule.matcher, sourcePath)) {
      return true;
    }
  }
  return matchesExtensionHostPathMatcher(params.index.loadPathMatcher, sourcePath);
}

export function matchesExplicitExtensionHostInstallRule(params: {
  pluginId: string;
  source: string;
  index: ExtensionHostProvenanceIndex;
  env: NodeJS.ProcessEnv;
}): boolean {
  const sourcePath = resolveUserPath(params.source, params.env);
  const installRule = params.index.installRules.get(params.pluginId);
  if (!installRule || installRule.trackedWithoutPaths) {
    return false;
  }
  return matchesExtensionHostPathMatcher(installRule.matcher, sourcePath);
}
