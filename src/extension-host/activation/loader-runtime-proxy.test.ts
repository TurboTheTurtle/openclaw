import { describe, expect, it } from "vitest";
import { createExtensionHostLazyRuntime } from "./loader-runtime-proxy.js";

describe("extension host loader runtime proxy", () => {
  it("creates the runtime lazily on first access", () => {
    let createCount = 0;
    const runtime = createExtensionHostLazyRuntime({
      createRuntime: () => {
        createCount += 1;
        return { value: 1 } as never;
      },
    });

    expect(createCount).toBe(0);
    expect((runtime as never as { value: number }).value).toBe(1);
    expect(createCount).toBe(1);
  });

  it("reuses the same runtime instance across proxy operations", () => {
    let createCount = 0;
    const runtime = createExtensionHostLazyRuntime({
      createRuntime: () => {
        createCount += 1;
        return { value: 1 } as never;
      },
    });

    expect("value" in (runtime as object)).toBe(true);
    expect(Object.keys(runtime as object)).toEqual(["value"]);
    expect((runtime as never as { value: number }).value).toBe(1);
    expect(createCount).toBe(1);
  });
});
