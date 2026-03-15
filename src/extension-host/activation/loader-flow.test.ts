import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizePluginsConfig } from "../../plugins/config-state.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import { processExtensionHostPluginCandidate } from "./loader-flow.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempPluginFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-loader-flow-"));
  tempDirs.push(rootDir);
  const entryPath = path.join(rootDir, "index.js");
  fs.writeFileSync(entryPath, "export default {}");
  return { rootDir, entryPath };
}

function createCandidate(
  rootDir: string,
  entryPath: string,
  overrides: Partial<PluginCandidate> = {},
): PluginCandidate {
  return {
    source: entryPath,
    rootDir,
    packageDir: rootDir,
    origin: "workspace",
    workspaceDir: "/workspace",
    ...overrides,
  };
}

function createManifestRecord(
  rootDir: string,
  entryPath: string,
  overrides: Partial<PluginManifestRecord> = {},
): PluginManifestRecord {
  return {
    id: "demo",
    name: "Demo",
    description: "Demo plugin",
    version: "1.0.0",
    kind: "context-engine",
    channels: [],
    providers: [],
    skills: [],
    origin: "workspace",
    workspaceDir: "/workspace",
    rootDir,
    source: entryPath,
    manifestPath: path.join(rootDir, "openclaw.plugin.json"),
    schemaCacheKey: "demo-schema",
    configSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
      additionalProperties: false,
    },
    resolvedExtension: {
      id: "demo",
      source: "/plugins/demo/index.ts",
      origin: "workspace",
      rootDir: "/plugins/demo",
      workspaceDir: "/workspace",
      static: {
        package: {},
        config: {},
        setup: {},
      },
      runtime: {
        kind: "context-engine",
        contributions: [],
      },
      policy: {},
    },
    ...overrides,
  };
}

function createRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    hooks: [],
    typedHooks: [],
    channels: [],
    providers: [],
    gatewayHandlers: {},
    httpRoutes: [],
    cliRegistrars: [],
    services: [],
    commands: [],
    diagnostics: [],
  };
}

describe("extension host loader flow", () => {
  it("handles validate-only candidates through the host orchestrator", () => {
    const { rootDir, entryPath } = createTempPluginFixture();
    const registry = createRegistry();

    const result = processExtensionHostPluginCandidate({
      candidate: createCandidate(rootDir, entryPath),
      manifestRecord: createManifestRecord(rootDir, entryPath),
      normalizedConfig: normalizePluginsConfig({
        entries: {
          demo: {
            enabled: true,
            config: { enabled: true },
          },
        },
      }),
      rootConfig: {
        plugins: {
          entries: {
            demo: {
              enabled: true,
              config: { enabled: true },
            },
          },
        },
      },
      validateOnly: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      registry,
      seenIds: new Map(),
      selectedMemoryPluginId: null,
      createApi: () => ({}) as never,
      loadModule: () =>
        ({
          default: {
            id: "demo",
            register: () => {},
          },
        }) as never,
    });

    expect(result).toEqual({
      selectedMemoryPluginId: null,
      memorySlotMatched: false,
    });
    expect(registry.plugins).toHaveLength(1);
    expect(registry.plugins[0]?.id).toBe("demo");
    expect(registry.plugins[0]?.status).toBe("loaded");
    expect(registry.plugins[0]?.lifecycleState).toBe("validated");
  });

  it("records import failures through the existing plugin error path", () => {
    const { rootDir, entryPath } = createTempPluginFixture();
    const registry = createRegistry();

    processExtensionHostPluginCandidate({
      candidate: createCandidate(rootDir, entryPath),
      manifestRecord: createManifestRecord(rootDir, entryPath),
      normalizedConfig: normalizePluginsConfig({
        entries: {
          demo: {
            enabled: true,
          },
        },
      }),
      rootConfig: {
        plugins: {
          entries: {
            demo: {
              enabled: true,
            },
          },
        },
      },
      validateOnly: false,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      registry,
      seenIds: new Map(),
      selectedMemoryPluginId: null,
      createApi: () => ({}) as never,
      loadModule: () => {
        throw new Error("boom");
      },
    });

    expect(registry.plugins).toHaveLength(1);
    expect(registry.plugins[0]?.status).toBe("error");
    expect(registry.plugins[0]?.lifecycleState).toBe("error");
    expect(registry.diagnostics[0]?.message).toContain("failed to load plugin");
  });

  it("records fully registered plugins before final readiness promotion", () => {
    const { rootDir, entryPath } = createTempPluginFixture();
    const registry = createRegistry();

    processExtensionHostPluginCandidate({
      candidate: createCandidate(rootDir, entryPath),
      manifestRecord: createManifestRecord(rootDir, entryPath),
      normalizedConfig: normalizePluginsConfig({
        entries: {
          demo: {
            enabled: true,
            config: { enabled: true },
          },
        },
      }),
      rootConfig: {
        plugins: {
          entries: {
            demo: {
              enabled: true,
              config: { enabled: true },
            },
          },
        },
      },
      validateOnly: false,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      registry,
      seenIds: new Map(),
      selectedMemoryPluginId: null,
      createApi: () => ({}) as never,
      loadModule: () =>
        ({
          default: {
            id: "demo",
            register: () => {},
          },
        }) as never,
    });

    expect(registry.plugins[0]?.lifecycleState).toBe("registered");
    expect(registry.plugins[0]?.status).toBe("loaded");
  });
});
