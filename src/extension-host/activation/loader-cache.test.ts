import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "../../plugins/registry.js";
import {
  buildExtensionHostRegistryCacheKey,
  clearExtensionHostRegistryCache,
  getCachedExtensionHostRegistry,
  MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES,
  setCachedExtensionHostRegistry,
} from "./loader-cache.js";

function createRegistry(id: string): PluginRegistry {
  return {
    plugins: [
      {
        id,
        name: id,
        source: `/plugins/${id}.js`,
        origin: "workspace",
        enabled: true,
        status: "loaded",
        lifecycleState: "registered",
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
      },
    ],
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

describe("extension host loader cache", () => {
  it("normalizes install paths into the cache key", () => {
    const env = { ...process.env, HOME: "/tmp/home" };

    const first = buildExtensionHostRegistryCacheKey({
      workspaceDir: "/workspace",
      plugins: {
        enabled: true,
        allow: [],
        loadPaths: ["~/plugins"],
        entries: {},
        slots: {},
      },
      installs: {
        demo: {
          installPath: "~/demo-install",
          sourcePath: "~/demo-source",
        },
      },
      env,
    });
    const second = buildExtensionHostRegistryCacheKey({
      workspaceDir: "/workspace",
      plugins: {
        enabled: true,
        allow: [],
        loadPaths: ["/tmp/home/plugins"],
        entries: {},
        slots: {},
      },
      installs: {
        demo: {
          installPath: "/tmp/home/demo-install",
          sourcePath: "/tmp/home/demo-source",
        },
      },
      env,
    });

    expect(first).toBe(second);
  });

  it("evicts least recently used registries", () => {
    clearExtensionHostRegistryCache();

    for (let index = 0; index < MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES + 1; index += 1) {
      setCachedExtensionHostRegistry(`cache-${index}`, createRegistry(`plugin-${index}`));
    }

    expect(getCachedExtensionHostRegistry("cache-0")).toBeUndefined();
    expect(
      getCachedExtensionHostRegistry(`cache-${MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES}`),
    ).toBeDefined();
  });

  it("refreshes cache insertion order on reads", () => {
    clearExtensionHostRegistryCache();

    for (let index = 0; index < MAX_EXTENSION_HOST_REGISTRY_CACHE_ENTRIES; index += 1) {
      setCachedExtensionHostRegistry(`cache-${index}`, createRegistry(`plugin-${index}`));
    }

    const refreshed = getCachedExtensionHostRegistry("cache-0");
    expect(refreshed).toBeDefined();

    setCachedExtensionHostRegistry("cache-new", createRegistry("plugin-new"));

    expect(getCachedExtensionHostRegistry("cache-1")).toBeUndefined();
    expect(getCachedExtensionHostRegistry("cache-0")).toBe(refreshed);
  });
});
