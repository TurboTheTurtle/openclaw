import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { PluginCandidate } from "../../plugins/discovery.js";
import {
  buildExtensionHostProvenanceIndex,
  compareExtensionHostDuplicateCandidateOrder,
  createExtensionHostPluginRecord,
} from "./loader-policy.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-loader-policy-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("extension host loader policy", () => {
  it("creates normalized plugin records", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo-plugin",
      source: "/plugins/demo/index.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });

    expect(record).toMatchObject({
      id: "demo-plugin",
      name: "demo-plugin",
      source: "/plugins/demo/index.js",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      lifecycleState: "prepared",
      configSchema: true,
    });
  });

  it("prefers explicit global installs over auto-discovered globals", () => {
    const installDir = makeTempDir();
    const autoDir = makeTempDir();
    const env = { ...process.env, HOME: makeTempDir() };
    const provenance = buildExtensionHostProvenanceIndex({
      config: {
        plugins: {
          installs: {
            demo: {
              installPath: installDir,
            },
          },
        },
      },
      normalizedLoadPaths: [],
      env,
    });

    const manifestByRoot = new Map<string, { id: string }>([
      [installDir, { id: "demo" }],
      [autoDir, { id: "demo" }],
    ]);
    const explicitCandidate: PluginCandidate = {
      idHint: "demo",
      source: path.join(installDir, "index.js"),
      rootDir: installDir,
      origin: "global",
    };
    const autoCandidate: PluginCandidate = {
      idHint: "demo",
      source: path.join(autoDir, "index.js"),
      rootDir: autoDir,
      origin: "global",
    };

    expect(
      compareExtensionHostDuplicateCandidateOrder({
        left: explicitCandidate,
        right: autoCandidate,
        manifestByRoot,
        provenance,
        env,
      }),
    ).toBeLessThan(0);
  });
});
