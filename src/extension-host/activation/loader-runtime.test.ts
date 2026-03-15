import { describe, expect, it } from "vitest";
import { createExtensionHostPluginRecord } from "../policy/loader-policy.js";
import {
  applyExtensionHostDefinitionToRecord,
  resolveExtensionHostEarlyMemoryDecision,
  resolveExtensionHostMemoryDecision,
  resolveExtensionHostModuleExport,
  validateExtensionHostConfig,
} from "./loader-runtime.js";

describe("extension host loader runtime", () => {
  it("resolves function exports as register handlers", () => {
    const register = () => {};
    expect(resolveExtensionHostModuleExport(register)).toEqual({
      register,
    });
  });

  it("resolves object exports with default values", () => {
    const register = () => {};
    const definition = {
      id: "demo",
      register,
    };
    expect(resolveExtensionHostModuleExport({ default: definition })).toEqual({
      definition,
      register,
    });
  });

  it("applies export metadata to plugin records", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });
    record.kind = "memory";
    const diagnostics: Array<{ level: "warn" | "error"; message: string }> = [];

    const result = applyExtensionHostDefinitionToRecord({
      record,
      definition: {
        id: "demo",
        name: "Demo Plugin",
        description: "demo desc",
        version: "1.2.3",
        kind: "memory",
      },
      diagnostics,
    });

    expect(result).toEqual({ ok: true });
    expect(record.name).toBe("Demo Plugin");
    expect(record.description).toBe("demo desc");
    expect(record.version).toBe("1.2.3");
    expect(diagnostics).toEqual([]);
  });

  it("rejects export id mismatches", () => {
    const record = createExtensionHostPluginRecord({
      id: "demo",
      source: "/plugins/demo.js",
      origin: "workspace",
      enabled: true,
      configSchema: true,
    });

    expect(
      applyExtensionHostDefinitionToRecord({
        record,
        definition: {
          id: "other",
        },
        diagnostics: [],
      }),
    ).toEqual({
      ok: false,
      message: 'plugin id mismatch (config uses "demo", export uses "other")',
    });
  });

  it("validates config through the host helper", () => {
    expect(
      validateExtensionHostConfig({
        schema: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          additionalProperties: false,
        },
        value: { enabled: true },
      }),
    ).toMatchObject({
      ok: true,
      value: { enabled: true },
    });
  });

  it("can disable bundled memory plugins early based on slot policy", () => {
    const result = resolveExtensionHostEarlyMemoryDecision({
      origin: "bundled",
      manifestKind: "memory",
      recordId: "memory-b",
      memorySlot: "memory-a",
      selectedMemoryPluginId: null,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('memory slot set to "memory-a"');
  });

  it("returns the post-definition memory slot decision", () => {
    const result = resolveExtensionHostMemoryDecision({
      recordId: "memory-a",
      recordKind: "memory",
      memorySlot: "memory-a",
      selectedMemoryPluginId: null,
    });

    expect(result).toEqual({
      enabled: true,
      selected: true,
    });
  });
});
