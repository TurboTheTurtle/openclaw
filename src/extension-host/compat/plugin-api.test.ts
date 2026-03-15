import { describe, expect, it, vi } from "vitest";
import type { PluginRecord } from "../../plugins/registry.js";
import { createExtensionHostPluginApi, normalizeExtensionHostPluginLogger } from "./plugin-api.js";

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

describe("extension host plugin api", () => {
  it("normalizes plugin logger methods", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const normalized = normalizeExtensionHostPluginLogger(logger);
    normalized.info("x");

    expect(logger.info).toHaveBeenCalledWith("x");
    expect(normalized.debug).toBe(logger.debug);
  });

  it("creates a compatibility plugin api that delegates all registration calls", () => {
    const callbacks = {
      registerTool: vi.fn(),
      registerHook: vi.fn(),
      registerHttpRoute: vi.fn(),
      registerChannel: vi.fn(),
      registerProvider: vi.fn(),
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      registerCommand: vi.fn(),
      registerContextEngine: vi.fn(),
      on: vi.fn(),
    };

    const api = createExtensionHostPluginApi({
      record: createRecord(),
      runtime: {} as never,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      config: {},
      registerTool: callbacks.registerTool as never,
      registerHook: callbacks.registerHook as never,
      registerHttpRoute: callbacks.registerHttpRoute as never,
      registerChannel: callbacks.registerChannel as never,
      registerProvider: callbacks.registerProvider as never,
      registerGatewayMethod: callbacks.registerGatewayMethod as never,
      registerCli: callbacks.registerCli as never,
      registerService: callbacks.registerService as never,
      registerCommand: callbacks.registerCommand as never,
      registerContextEngine: callbacks.registerContextEngine as never,
      on: callbacks.on as never,
    });

    api.registerTool({ name: "tool" } as never);
    api.registerHook("before_send", (() => {}) as never);
    api.registerHttpRoute({ path: "/x", handler: (() => {}) as never, auth: "gateway" });
    api.registerChannel({ id: "ch" } as never);
    api.registerProvider({} as never);
    api.registerGatewayMethod("ping", (() => {}) as never);
    api.registerCli((() => {}) as never);
    api.registerService({ id: "svc", start: async () => {}, stop: async () => {} } as never);
    api.registerCommand({ name: "cmd", description: "demo", handler: async () => ({}) } as never);
    api.registerContextEngine("engine", (() => ({}) as never) as never);
    api.on("before_send" as never, (() => {}) as never);

    expect(callbacks.registerTool).toHaveBeenCalledTimes(1);
    expect(callbacks.registerHook).toHaveBeenCalledTimes(1);
    expect(callbacks.registerHttpRoute).toHaveBeenCalledTimes(1);
    expect(callbacks.registerChannel).toHaveBeenCalledTimes(1);
    expect(callbacks.registerProvider).toHaveBeenCalledTimes(1);
    expect(callbacks.registerGatewayMethod).toHaveBeenCalledTimes(1);
    expect(callbacks.registerCli).toHaveBeenCalledTimes(1);
    expect(callbacks.registerService).toHaveBeenCalledTimes(1);
    expect(callbacks.registerCommand).toHaveBeenCalledTimes(1);
    expect(callbacks.registerContextEngine).toHaveBeenCalledTimes(1);
    expect(callbacks.on).toHaveBeenCalledTimes(1);
  });
});
