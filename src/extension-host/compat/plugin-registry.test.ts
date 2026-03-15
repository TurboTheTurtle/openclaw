import { describe, expect, it, vi } from "vitest";
import { clearPluginCommands } from "../../plugins/commands.js";
import { createEmptyPluginRegistry, type PluginRecord } from "../../plugins/registry.js";
import { createExtensionHostPluginRegistry } from "./plugin-registry.js";

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

describe("extension host plugin registry", () => {
  it("registers providers through the host-owned facade", () => {
    const registry = createEmptyPluginRegistry();
    const facade = createExtensionHostPluginRegistry({
      registry,
      registryParams: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
        runtime: {} as never,
      },
    });

    facade.registerProvider(createRecord(), {
      id: " demo-provider ",
      label: " Demo Provider ",
      auth: [{ id: " api-key ", label: " API Key " }],
    } as never);

    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0]?.provider.id).toBe("demo-provider");
    expect(registry.providers[0]?.provider.label).toBe("Demo Provider");
    expect(registry.providers[0]?.provider.auth[0]?.id).toBe("api-key");
  });

  it("records command registration failures as diagnostics through the host-owned facade", () => {
    clearPluginCommands();
    const registry = createEmptyPluginRegistry();
    const facade = createExtensionHostPluginRegistry({
      registry,
      registryParams: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
        runtime: {} as never,
      },
    });
    const record = createRecord();

    facade.registerCommand(record, {
      name: "demo",
      description: "first",
      handler: async () => ({ handled: true }),
    });
    facade.registerCommand(record, {
      name: "demo",
      description: "second",
      handler: async () => ({ handled: true }),
    });

    expect(registry.commands).toHaveLength(1);
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
