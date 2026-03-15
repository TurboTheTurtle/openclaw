import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { normalizePluginsConfig } from "../../plugins/config-state.js";
import type { PluginCandidate } from "../../plugins/discovery.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import { resolveExtensionHostActivationPolicy } from "./loader-activation-policy.js";

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

describe("extension host loader activation policy", () => {
  it("returns duplicate policy outcomes", () => {
    const outcome = resolveExtensionHostActivationPolicy({
      candidate: createCandidate(),
      manifestRecord: createManifestRecord(),
      normalizedConfig: normalizePluginsConfig({}),
      rootConfig: {},
      seenIds: new Map([["demo", "bundled" as const]]),
      selectedMemoryPluginId: null,
    });

    expect(outcome).toMatchObject({
      kind: "duplicate",
      pluginId: "demo",
      record: {
        status: "disabled",
        error: "overridden by bundled plugin",
      },
    });
  });

  it("returns disabled policy outcomes for config-disabled plugins", () => {
    const rootConfig: OpenClawConfig = {
      plugins: {
        entries: {
          demo: {
            enabled: false,
          },
        },
      },
    };

    const outcome = resolveExtensionHostActivationPolicy({
      candidate: createCandidate(),
      manifestRecord: createManifestRecord(),
      normalizedConfig: normalizePluginsConfig(rootConfig.plugins),
      rootConfig,
      seenIds: new Map(),
      selectedMemoryPluginId: null,
    });

    expect(outcome).toMatchObject({
      kind: "disabled",
      pluginId: "demo",
      reason: "disabled in config",
      record: {
        status: "disabled",
        lifecycleState: "disabled",
      },
    });
  });

  it("returns candidate outcomes when policy allows activation", () => {
    const outcome = resolveExtensionHostActivationPolicy({
      candidate: createCandidate({ origin: "bundled" }),
      manifestRecord: createManifestRecord({ origin: "bundled", kind: "memory" }),
      normalizedConfig: normalizePluginsConfig({
        slots: {
          memory: "demo",
        },
      }),
      rootConfig: {},
      seenIds: new Map(),
      selectedMemoryPluginId: null,
    });

    expect(outcome).toMatchObject({
      kind: "candidate",
      pluginId: "demo",
      record: {
        lifecycleState: "prepared",
      },
    });
  });
});
