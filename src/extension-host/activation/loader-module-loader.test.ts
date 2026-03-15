import { describe, expect, it } from "vitest";
import { createExtensionHostModuleLoader } from "./loader-module-loader.js";

describe("extension host module loader", () => {
  it("creates the jiti loader lazily and reuses it", () => {
    let createCount = 0;
    const loadedSources: string[] = [];

    const loadModule = createExtensionHostModuleLoader({
      importMetaUrl: "file:///test-loader.ts",
      createJitiLoader: (_url, options) => {
        createCount += 1;
        expect(options.alias).toEqual({
          "openclaw/plugin-sdk": "/sdk/index.ts",
          "openclaw/plugin-sdk/telegram": "/sdk/telegram.ts",
        });
        return ((safeSource: string) => {
          loadedSources.push(safeSource);
          return { safeSource };
        }) as never;
      },
      resolvePluginSdkAliasFn: () => "/sdk/index.ts",
      resolvePluginSdkScopedAliasMapFn: () => ({
        "openclaw/plugin-sdk/telegram": "/sdk/telegram.ts",
      }),
    });

    expect(createCount).toBe(0);
    expect(loadModule("/plugins/one.ts")).toEqual({ safeSource: "/plugins/one.ts" });
    expect(loadModule("/plugins/two.ts")).toEqual({ safeSource: "/plugins/two.ts" });
    expect(createCount).toBe(1);
    expect(loadedSources).toEqual(["/plugins/one.ts", "/plugins/two.ts"]);
  });

  it("omits alias config when no aliases resolve", () => {
    const loadModule = createExtensionHostModuleLoader({
      importMetaUrl: "file:///test-loader.ts",
      createJitiLoader: (_url, options) => {
        expect(options.alias).toBeUndefined();
        return ((safeSource: string) => ({ safeSource })) as never;
      },
      resolvePluginSdkAliasFn: () => null,
      resolvePluginSdkScopedAliasMapFn: () => ({}),
    });

    expect(loadModule("/plugins/demo.ts")).toEqual({ safeSource: "/plugins/demo.ts" });
  });
});
