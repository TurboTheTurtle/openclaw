import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { applyExtensionHostExclusiveSlotSelection } from "./slot-arbitration.js";

describe("extension host slot arbitration", () => {
  const createMemoryConfig = (plugins?: OpenClawConfig["plugins"]): OpenClawConfig => ({
    plugins: {
      ...plugins,
      entries: {
        ...plugins?.entries,
        memory: {
          enabled: true,
          ...plugins?.entries?.memory,
        },
      },
    },
  });

  it("selects the slot and disables competing plugins of the same kind", () => {
    const config = createMemoryConfig({
      slots: { memory: "memory-core" },
      entries: { "memory-core": { enabled: true } },
    });
    const result = applyExtensionHostExclusiveSlotSelection({
      config,
      selectedId: "memory",
      selectedKind: "memory",
      registry: {
        plugins: [
          { id: "memory-core", kind: "memory" },
          { id: "memory", kind: "memory" },
        ],
      },
    });

    expect(result.changed).toBe(true);
    expect(result.config.plugins?.slots?.memory).toBe("memory");
    expect(result.config.plugins?.entries?.["memory-core"]?.enabled).toBe(false);
    expect(result.warnings).toContain(
      'Exclusive slot "memory" switched from "memory-core" to "memory".',
    );
    expect(result.warnings).toContain('Disabled other "memory" slot plugins: memory-core.');
  });
});
