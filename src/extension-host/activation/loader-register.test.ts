import { describe, expect, it } from "vitest";
import type { PluginDiagnostic } from "../../plugins/types.js";
import { createExtensionHostPluginRecord } from "../policy/loader-policy.js";
import {
  planExtensionHostLoadedPlugin,
  runExtensionHostPluginRegister,
} from "./loader-register.js";

describe("extension host loader register", () => {
  it("returns a register plan for valid loaded plugins", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });
    const diagnostics: PluginDiagnostic[] = [];

    const plan = planExtensionHostLoadedPlugin({
      record,
      manifestRecord: {
        configSchema: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      definition: {
        id: "demo",
      },
      register: () => {},
      diagnostics,
      selectedMemoryPluginId: null,
      entryConfig: { enabled: true },
      validateOnly: false,
    });

    expect(plan).toMatchObject({
      kind: "register",
      pluginConfig: { enabled: true },
      selectedMemoryPluginId: null,
    });
  });

  it("returns invalid-config plans with the normalized message", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });

    const plan = planExtensionHostLoadedPlugin({
      record,
      manifestRecord: {
        configSchema: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      diagnostics: [],
      selectedMemoryPluginId: null,
      entryConfig: { nope: true },
      validateOnly: false,
    });

    expect(plan.kind).toBe("invalid-config");
    expect(plan.message).toContain("invalid config:");
  });

  it("returns missing-register plans when validation passes but no register function exists", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });

    expect(
      planExtensionHostLoadedPlugin({
        record,
        manifestRecord: {
          configSchema: {
            type: "object",
          },
        },
        diagnostics: [],
        selectedMemoryPluginId: null,
        validateOnly: false,
      }),
    ).toMatchObject({
      kind: "missing-register",
      message: "plugin export missing register/activate",
    });
  });

  it("runs register through the provided api factory and records async warnings", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });
    const diagnostics: PluginDiagnostic[] = [];
    let apiSeen = false;

    const result = runExtensionHostPluginRegister({
      register: async (api) => {
        apiSeen = api.id === "demo";
      },
      createApi: (pluginRecord, options) =>
        ({
          id: pluginRecord.id,
          name: pluginRecord.name,
          source: pluginRecord.source,
          config: options.config,
          pluginConfig: options.pluginConfig,
        }) as never,
      record,
      config: {},
      pluginConfig: { enabled: true },
      diagnostics,
    });

    expect(result).toEqual({ ok: true });
    expect(apiSeen).toBe(true);
    expect(diagnostics).toContainEqual({
      level: "warn",
      pluginId: "demo",
      source: "/plugins/demo.js",
      message: "plugin register returned a promise; async registration is ignored",
    });
  });
});
