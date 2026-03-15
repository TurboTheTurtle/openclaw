import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "../../plugins/registry.js";
import { resolveExtensionHostFinalizationPolicy } from "./loader-finalization-policy.js";

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

describe("extension host loader finalization policy", () => {
  it("emits memory-slot diagnostics when no selected memory plugin matched", () => {
    const result = resolveExtensionHostFinalizationPolicy({
      registry: createRegistry(),
      memorySlot: "memory-a",
      memorySlotMatched: false,
      provenance: {
        loadPathMatcher: { exact: new Set(), dirs: [] },
        installRules: new Map(),
      },
      env: process.env,
    });

    expect(result.diagnostics).toContainEqual({
      level: "warn",
      message: "memory slot plugin not found or not marked as memory: memory-a",
    });
  });

  it("emits provenance warnings for untracked non-bundled plugins", () => {
    const registry = createRegistry();
    registry.plugins.push({
      id: "demo",
      name: "demo",
      source: "/tmp/demo/index.js",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      lifecycleState: "ready",
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
      configSchema: false,
    });

    const result = resolveExtensionHostFinalizationPolicy({
      registry,
      memorySlotMatched: true,
      provenance: {
        loadPathMatcher: { exact: new Set(), dirs: [] },
        installRules: new Map(),
      },
      env: process.env,
    });

    expect(result.diagnostics).toContainEqual({
      level: "warn",
      pluginId: "demo",
      source: "/tmp/demo/index.js",
      message:
        "loaded without install/load-path provenance; treat as untracked local code and pin trust via plugins.allow or install records",
    });
    expect(result.warningMessages[0]).toContain("[plugins] demo:");
  });
});
