import { describe, expect, it } from "vitest";
import {
  clearExtensionHostLoaderHostState,
  getExtensionHostDiscoveryWarningCache,
} from "./loader-host-state.js";

describe("extension host loader host state", () => {
  it("clears the shared discovery warning cache", () => {
    const warningCache = getExtensionHostDiscoveryWarningCache();
    warningCache.add("warn-key");

    clearExtensionHostLoaderHostState();

    expect(getExtensionHostDiscoveryWarningCache().size).toBe(0);
  });
});
