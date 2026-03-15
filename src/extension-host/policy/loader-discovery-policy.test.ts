import { describe, expect, it } from "vitest";
import { resolveExtensionHostDiscoveryPolicy } from "./loader-discovery-policy.js";

describe("extension host loader discovery policy", () => {
  it("warns when allowlist is open for non-bundled discoverable plugins", () => {
    const warningCache = new Set<string>();

    const result = resolveExtensionHostDiscoveryPolicy({
      pluginsEnabled: true,
      allow: [],
      warningCacheKey: "warn-key",
      warningCache,
      discoverablePlugins: [
        { id: "bundled", source: "/bundled/index.js", origin: "bundled" },
        { id: "workspace-demo", source: "/workspace/demo.js", origin: "workspace" },
      ],
    });

    expect(result.warningMessages).toHaveLength(1);
    expect(result.warningMessages[0]).toContain("plugins.allow is empty");
    expect(warningCache.has("warn-key")).toBe(true);
  });

  it("does not warn twice for the same cache key", () => {
    const warningCache = new Set<string>(["warn-key"]);

    const result = resolveExtensionHostDiscoveryPolicy({
      pluginsEnabled: true,
      allow: [],
      warningCacheKey: "warn-key",
      warningCache,
      discoverablePlugins: [
        { id: "workspace-demo", source: "/workspace/demo.js", origin: "workspace" },
      ],
    });

    expect(result.warningMessages).toHaveLength(0);
  });
});
