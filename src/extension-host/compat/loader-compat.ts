import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveOpenClawPackageRootSync } from "../../infra/openclaw-root.js";

type PluginSdkAliasCandidateKind = "dist" | "src";

const cachedPluginSdkExportedSubpaths = new Map<string, string[]>();

export function resolvePluginSdkAliasCandidateOrder(params: {
  modulePath: string;
  isProduction: boolean;
}): PluginSdkAliasCandidateKind[] {
  const normalizedModulePath = params.modulePath.replace(/\\/g, "/");
  const isDistRuntime = normalizedModulePath.includes("/dist/");
  return isDistRuntime || params.isProduction ? ["dist", "src"] : ["src", "dist"];
}

export function listPluginSdkAliasCandidates(params: {
  srcFile: string;
  distFile: string;
  modulePath: string;
}): string[] {
  const orderedKinds = resolvePluginSdkAliasCandidateOrder({
    modulePath: params.modulePath,
    isProduction: process.env.NODE_ENV === "production",
  });
  let cursor = path.dirname(params.modulePath);
  const candidates: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const candidateMap = {
      src: path.join(cursor, "src", "plugin-sdk", params.srcFile),
      dist: path.join(cursor, "dist", "plugin-sdk", params.distFile),
    } as const;
    for (const kind of orderedKinds) {
      candidates.push(candidateMap[kind]);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return candidates;
}

export function resolvePluginSdkAliasFile(params: {
  srcFile: string;
  distFile: string;
  modulePath?: string;
}): string | null {
  try {
    const modulePath = params.modulePath ?? fileURLToPath(import.meta.url);
    for (const candidate of listPluginSdkAliasCandidates({
      srcFile: params.srcFile,
      distFile: params.distFile,
      modulePath,
    })) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function resolvePluginSdkAlias(): string | null {
  return resolvePluginSdkAliasFile({ srcFile: "root-alias.cjs", distFile: "root-alias.cjs" });
}

export function listPluginSdkExportedSubpaths(params: { modulePath?: string } = {}): string[] {
  const modulePath = params.modulePath ?? fileURLToPath(import.meta.url);
  const packageRoot = resolveOpenClawPackageRootSync({
    cwd: path.dirname(modulePath),
  });
  if (!packageRoot) {
    return [];
  }
  const cached = cachedPluginSdkExportedSubpaths.get(packageRoot);
  if (cached) {
    return cached;
  }
  try {
    const pkgRaw = fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as {
      exports?: Record<string, unknown>;
    };
    const subpaths = Object.keys(pkg.exports ?? {})
      .filter((key) => key.startsWith("./plugin-sdk/"))
      .map((key) => key.slice("./plugin-sdk/".length))
      .filter((subpath) => Boolean(subpath) && !subpath.includes("/"))
      .toSorted();
    cachedPluginSdkExportedSubpaths.set(packageRoot, subpaths);
    return subpaths;
  } catch {
    return [];
  }
}

export function resolvePluginSdkScopedAliasMap(): Record<string, string> {
  const aliasMap: Record<string, string> = {};
  for (const subpath of listPluginSdkExportedSubpaths()) {
    const resolved = resolvePluginSdkAliasFile({
      srcFile: `${subpath}.ts`,
      distFile: `${subpath}.js`,
    });
    if (resolved) {
      aliasMap[`openclaw/plugin-sdk/${subpath}`] = resolved;
    }
  }
  return aliasMap;
}
