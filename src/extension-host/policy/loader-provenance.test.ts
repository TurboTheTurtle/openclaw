import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addExtensionHostPathToMatcher,
  createExtensionHostPathMatcher,
  isExtensionHostTrackedByProvenance,
  matchesExplicitExtensionHostInstallRule,
  safeRealpathOrResolveExtensionHostPath,
  type ExtensionHostProvenanceIndex,
} from "./loader-provenance.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-loader-provenance-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("extension host loader provenance", () => {
  it("tracks plugins by load path directories", () => {
    const trackedDir = makeTempDir();
    const trackedFile = path.join(trackedDir, "tracked.js");
    fs.writeFileSync(trackedFile, "export {};\n", "utf8");

    const loadPathMatcher = createExtensionHostPathMatcher();
    addExtensionHostPathToMatcher(loadPathMatcher, trackedDir);

    const index: ExtensionHostProvenanceIndex = {
      loadPathMatcher,
      installRules: new Map(),
    };

    expect(
      isExtensionHostTrackedByProvenance({
        pluginId: "tracked",
        source: trackedFile,
        index,
        env: process.env,
      }),
    ).toBe(true);
  });

  it("matches explicit install rules only when tracked paths are present", () => {
    const installDir = makeTempDir();
    const installFile = path.join(installDir, "plugin.js");
    fs.writeFileSync(installFile, "export {};\n", "utf8");

    const installMatcher = createExtensionHostPathMatcher();
    addExtensionHostPathToMatcher(installMatcher, installDir);

    const index: ExtensionHostProvenanceIndex = {
      loadPathMatcher: createExtensionHostPathMatcher(),
      installRules: new Map([
        [
          "demo",
          {
            trackedWithoutPaths: false,
            matcher: installMatcher,
          },
        ],
      ]),
    };

    expect(
      matchesExplicitExtensionHostInstallRule({
        pluginId: "demo",
        source: installFile,
        index,
        env: process.env,
      }),
    ).toBe(true);
  });

  it("falls back to resolved paths when realpath fails", () => {
    const missingPath = path.join(makeTempDir(), "missing.js");

    expect(safeRealpathOrResolveExtensionHostPath(missingPath)).toBe(path.resolve(missingPath));
  });
});
