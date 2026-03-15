import { describe, expect, it, vi } from "vitest";
import { clearPluginCommands } from "../../plugins/commands.js";
import { createEmptyPluginRegistry, type PluginRecord } from "../../plugins/registry.js";
import {
  resolveExtensionHostCommandCompatibility,
  resolveExtensionHostProviderCompatibility,
} from "./plugin-registry-compat.js";

function createRecord(): PluginRecord {
  return {
    id: "demo",
    name: "Demo",
    source: "/plugins/demo.ts",
    origin: "workspace",
    enabled: true,
    status: "loaded",
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
  };
}

describe("extension host plugin registry compatibility", () => {
  it("normalizes provider registration through the host-owned compatibility helper", () => {
    const result = resolveExtensionHostProviderCompatibility({
      registry: createEmptyPluginRegistry(),
      record: createRecord(),
      provider: {
        id: " demo-provider ",
        label: " Demo Provider ",
        auth: [{ id: " api-key ", label: " API Key " }],
      } as never,
    });

    expect(result).toMatchObject({
      ok: true,
      providerId: "demo-provider",
      entry: {
        provider: {
          id: "demo-provider",
          label: "Demo Provider",
          auth: [{ id: "api-key", label: "API Key" }],
        },
      },
    });
  });

  it("reports duplicate command registration through the host-owned compatibility helper", () => {
    clearPluginCommands();
    const registry = createEmptyPluginRegistry();
    const record = createRecord();

    const first = resolveExtensionHostCommandCompatibility({
      registry,
      record,
      command: {
        name: "demo",
        description: "first",
        handler: vi.fn(async () => ({ handled: true })),
      },
    });
    const second = resolveExtensionHostCommandCompatibility({
      registry,
      record,
      command: {
        name: "demo",
        description: "second",
        handler: vi.fn(async () => ({ handled: true })),
      },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(registry.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        pluginId: "demo",
        message: 'command registration failed: Command "demo" already registered by plugin "demo"',
      }),
    );

    clearPluginCommands();
  });
});
