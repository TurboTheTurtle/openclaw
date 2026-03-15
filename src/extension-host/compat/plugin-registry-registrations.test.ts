import { describe, expect, it } from "vitest";
import { createEmptyPluginRegistry, type PluginRecord } from "../../plugins/registry.js";
import { createExtensionHostPluginRegistrationActions } from "./plugin-registry-registrations.js";

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

describe("extension host plugin registry registrations", () => {
  it("reports gateway-method collisions against core methods", () => {
    const registry = createEmptyPluginRegistry();
    const actions = createExtensionHostPluginRegistrationActions({
      registry,
      coreGatewayMethods: new Set(["ping"]),
      pushDiagnostic: (diag) => {
        registry.diagnostics.push(diag);
      },
    });

    actions.registerGatewayMethod(createRecord(), "ping", (() => {}) as never);

    expect(registry.gatewayHandlers.ping).toBeUndefined();
    expect(registry.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        pluginId: "demo",
      }),
    );
  });

  it("reports invalid context-engine registrations through the host-owned action helper", () => {
    const registry = createEmptyPluginRegistry();
    const actions = createExtensionHostPluginRegistrationActions({
      registry,
      coreGatewayMethods: new Set(),
      pushDiagnostic: (diag) => {
        registry.diagnostics.push(diag);
      },
    });

    actions.registerContextEngine(createRecord(), "   ", (() => ({})) as never);

    expect(registry.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        pluginId: "demo",
        message: "context engine registration missing id",
      }),
    );
  });
});
