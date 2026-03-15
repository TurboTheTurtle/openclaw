import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { normalizePluginsConfig } from "../../plugins/config-state.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import { prepareExtensionHostPluginCandidate } from "./loader-records.js";

function createCandidate(overrides: Partial<PluginCandidate> = {}): PluginCandidate {
  return {
    source: "/plugins/demo/index.ts",
    rootDir: "/plugins/demo",
    packageDir: "/plugins/demo",
    origin: "workspace",
    workspaceDir: "/workspace",
    ...overrides,
  };
}

function createManifestRecord(overrides: Partial<PluginManifestRecord> = {}): PluginManifestRecord {
  return {
    id: "demo",
    name: "Demo",
    description: "Demo plugin",
    version: "1.0.0",
    kind: "tool",
    channels: [],
    providers: [],
    skills: [],
    origin: "workspace",
    workspaceDir: "/workspace",
    rootDir: "/plugins/demo",
    source: "/plugins/demo/index.ts",
    manifestPath: "/plugins/demo/openclaw.plugin.json",
    configSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
    },
    configUiHints: {
      enabled: { sensitive: false },
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
        kind: "tool",
        contributions: [],
      },
      policy: {},
    },
    ...overrides,
  };
}

describe("extension host loader records", () => {
  it("prepares duplicate candidates as disabled compatibility records", () => {
    const seenIds = new Map<string, "workspace" | "global" | "bundled" | "config">([
      ["demo", "bundled"],
    ]);

    const prepared = prepareExtensionHostPluginCandidate({
      candidate: createCandidate(),
      manifestRecord: createManifestRecord(),
      normalizedConfig: normalizePluginsConfig({}),
      rootConfig: {},
      seenIds,
    });

    expect(prepared).toMatchObject({
      kind: "duplicate",
      pluginId: "demo",
      record: {
        enabled: false,
        status: "disabled",
        error: "overridden by bundled plugin",
      },
    });
  });

  it("prepares candidate records with manifest metadata and config entry", () => {
    const rootConfig: OpenClawConfig = {
      plugins: {
        entries: {
          demo: {
            enabled: true,
            config: { enabled: true },
          },
        },
      },
    };

    const prepared = prepareExtensionHostPluginCandidate({
      candidate: createCandidate({ origin: "bundled" }),
      manifestRecord: createManifestRecord({ origin: "bundled" }),
      normalizedConfig: normalizePluginsConfig(rootConfig.plugins),
      rootConfig,
      seenIds: new Map(),
    });

    expect(prepared).toMatchObject({
      kind: "candidate",
      pluginId: "demo",
      entry: {
        enabled: true,
        config: { enabled: true },
      },
      enableState: {
        enabled: true,
      },
      record: {
        id: "demo",
        name: "Demo",
        kind: "tool",
        configJsonSchema: {
          type: "object",
        },
      },
    });
  });

  it("preserves disabled-by-config decisions in the prepared record", () => {
    const rootConfig: OpenClawConfig = {
      plugins: {
        entries: {
          demo: {
            enabled: false,
          },
        },
      },
    };

    const prepared = prepareExtensionHostPluginCandidate({
      candidate: createCandidate({ origin: "bundled" }),
      manifestRecord: createManifestRecord({ origin: "bundled" }),
      normalizedConfig: normalizePluginsConfig(rootConfig.plugins),
      rootConfig,
      seenIds: new Map(),
    });

    expect(prepared).toMatchObject({
      kind: "candidate",
      enableState: {
        enabled: false,
        reason: "disabled in config",
      },
      record: {
        enabled: false,
        status: "disabled",
      },
    });
  });
});
