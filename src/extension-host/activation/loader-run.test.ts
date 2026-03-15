import { describe, expect, it, vi } from "vitest";
import type { PluginRegistry } from "../../plugins/registry.js";
import { runExtensionHostLoaderSession } from "./loader-run.js";

vi.mock("./loader-session.js", () => ({
  processExtensionHostLoaderSessionCandidate: vi.fn(),
  finalizeExtensionHostLoaderSession: vi.fn((session) => session.registry),
}));

describe("extension host loader run", () => {
  it("processes only candidates with manifest records and then finalizes", async () => {
    const sessionModule = await import("./loader-session.js");
    const processCandidate = vi.mocked(sessionModule.processExtensionHostLoaderSessionCandidate);
    const finalizeSession = vi.mocked(sessionModule.finalizeExtensionHostLoaderSession);

    const registry = { plugins: [], diagnostics: [] } as unknown as PluginRegistry;
    const session = {
      registry,
    } as never;

    const result = runExtensionHostLoaderSession({
      session,
      orderedCandidates: [{ rootDir: "/plugins/a" }, { rootDir: "/plugins/missing" }],
      manifestByRoot: new Map([["/plugins/a", { rootDir: "/plugins/a" }]]),
      normalizedConfig: { entries: {}, slots: {} },
      rootConfig: {},
      validateOnly: false,
      createApi: vi.fn() as never,
      loadModule: vi.fn() as never,
    });

    expect(processCandidate).toHaveBeenCalledTimes(1);
    expect(finalizeSession).toHaveBeenCalledWith(session);
    expect(result).toBe(registry);
  });
});
